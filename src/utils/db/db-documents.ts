import { PGliteWorker } from "@electric-sql/pglite/worker";
import { RuleNode, RulesEngine } from "@/utils/rete-network";
import { getRootRules } from "@/utils/db/db-rules";


export const seedDb = async (pg: PGliteWorker, embeddings: any[], batchSize = 500) => {
    console.log("Seeding DB: ", embeddings);
    for (let i = 0; i < embeddings.length; i += batchSize) {
        const batch = embeddings.slice(i, i + batchSize);
        const values = batch.map((embedding, index) =>
            `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`
        ).join(", ");

        const params = batch.flatMap(embedding => [
            embedding.page,
            embedding.index,
            embedding.text,
            JSON.stringify(embedding.embedding_of_chunk)
        ]);

        await pg.query(
            `
            INSERT INTO embeddings (page_id, chunk_id, content, embedding)
            VALUES ${values};
            `,
            params
        );
    }
}


export const seedSingleDb = async (pg: PGliteWorker, embeddings: any[], batchSize = 500) => {
    console.log("Seeding DB: ", embeddings);
    const t1 = performance.now();
    for (let i = 0; i < embeddings.length; i += batchSize) {
        const batch = embeddings.slice(i, i + batchSize);
        const values = batch.map((embedding, index) =>
            `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`
        ).join(", ");

        const params = batch.flatMap(embedding => [embedding.content.page, embedding.content.index, embedding.content.text, JSON.stringify(embedding.embedding)]);

        await pg.query(
            `
            INSERT INTO embeddings (page_id, chunk_id, content, embedding)
            VALUES ${values};
            `,
            params
        );
    }
    const t2 = performance.now();
    console.log(`DB seed completed in ${((t2 - t1) / 1000).toFixed(2)} seconds`);
}

export const search = async (
    pg: PGliteWorker,
    embedding: any[],
    query: string,
    match_threshold = 0.8,
    limit = 3,
) => {
    const rules = await getRootRules(pg);
    const engine = new RulesEngine();

    rules.forEach((rule: RuleNode) => engine.addRootRule(rule));

    let pages: number | undefined = undefined;
    try {
        pages = engine.evaluate({query: query});
        console.log('Pages: ', pages);
    } catch (error) {
        console.error('Error evaluating rules: ', error);
    }
    console.log(typeof pages, pages);
    console.log('Pages: ', pages);

    let vectorResults;
    if (pages) {
        console.log('Using vector search with page', pages);
        vectorResults = await pg.query(
            `
          select * from embeddings
          where embeddings.page_id = $1
          `,
            [pages],
        );

        console.table(vectorResults.rows);
    } else {
        vectorResults = await pg.query(
            `
          select * from embeddings
          where embeddings.embedding <#> $1 < $2
          order by embeddings.embedding <#> $1
          limit $3;
          `,
            [JSON.stringify(embedding), -Number(match_threshold), Number(limit)],
        );
    }

    const bm25Results = await pg.query(
        `
      select *, ts_rank_cd(to_tsvector(content), plainto_tsquery($1)) as rank
      from embeddings
      where to_tsvector(content) @@ plainto_tsquery($1)
      order by rank desc
      limit $2;
      `,
        [query, Number(limit)],
    );

    const combinedResults = [...vectorResults.rows, ...bm25Results.rows]
        .sort((a: any, b: any) => (a.distance || 0) - (b.distance || 0) + (b.rank || 0) - (a.rank || 0))
        .slice(0, limit);

    const formattedChunks = combinedResults.map((result: any) => `- ${result.content}`);

    return formattedChunks;
};

export const getTotalPages = async (pg: PGliteWorker) => {
    const totalPages: any = await pg.query(`SELECT MAX(page_id) FROM embeddings`);
    return totalPages.rows[0].max;
}