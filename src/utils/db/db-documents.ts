import { PGliteWorker } from "@electric-sql/pglite/worker";

/**
 * Seeds the database with embeddings.
 * @param pg - The PGliteWorker instance.
 * @param embeddings - The embeddings to seed the database with.
 * @param batchSize - The size of each batch to insert (default is 500).
 */
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

/**
 * Seeds the database with a single embedding.
 * @param pg - The PGliteWorker instance.
 * @param embeddings - The embedding to seed the database with.
 * @param batchSize - The size of each batch to insert (default is 500).
 */
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

/**
 * Searches the database for embeddings matching a query.
 * @param pg - The PGliteWorker instance.
 * @param embedding - The embedding to search for.
 * @param query - The query to search for.
 * @param match_threshold - The threshold for matching (default is 0.8).
 * @param limit - The maximum number of results to return (default is 3).
 */
export const search = async (
    pg: PGliteWorker,
    embedding: any[],
    query: string,
    match_threshold = 0.8,
    limit = 3,
) => {
    let vectorResults;
    vectorResults = await pg.query(
        `
          select * from embeddings
          where embeddings.embedding <#> $1 < $2
          order by embeddings.embedding <#> $1
          limit $3;
          `,
        [JSON.stringify(embedding), -Number(match_threshold), Number(limit)],
    );

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

    return combinedResults.map((result: any) => ({
        content: `- ${result.content}`,
        page_id: result.page_id,
    }));
};

/**
 * Searches the database for embeddings matching a query and page number.
 * @param pg - The PGliteWorker instance.
 * @param query - The query to search for.
 * @param page - The page number to search for.
 * @param limit - The maximum number of results to return (default is 3).
 */
export const searchWithPage = async (
    pg: PGliteWorker,
    query: string,
    page: number,
    limit = 3,
) => {
    const results = await pg.query(
        `
        select * from embeddings
        where embeddings.page_id = $1
        `,
        [page],
    );

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

    const combinedResults = [...results.rows, ...bm25Results.rows]
    .sort((a: any, b: any) => (a.distance || 0) - (b.distance || 0) + (b.rank || 0) - (a.rank || 0))
    .slice(0, limit);

    return combinedResults.map((result: any) => ({
        content: `- ${result.content}`,
        page_id: result.page_id,
    }));
}

/**
 * Retrieves the total number of pages in the database.
 * @param pg - The PGliteWorker instance.
 * @returns The total number of pages.
 */
export const getTotalPages = async (pg: PGliteWorker) => {
    const totalPages: any = await pg.query(`SELECT MAX(page_id) FROM embeddings`);
    return totalPages.rows[0].max;
}