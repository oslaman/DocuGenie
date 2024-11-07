import { PGliteWorker } from "@electric-sql/pglite/worker";

/**
 * Seeds the database with the chunked content of a document.
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 * @param {any[]} chunks - The chunks to seed the database with.
 * @param {number} batchSize - The size of each batch to insert (default is 500).
 */
export const seedDb = async (pg: PGliteWorker, chunks: any[], batchSize = 500) => {
    console.log("Seeding DB: ", chunks);
    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
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
            INSERT INTO chunks (page_id, chunk_id, content, embedding)
            VALUES ${values};
            `,
            params
        );
    }
}

/**
 * Seeds the database with a single embedding.
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 * @param {any[]} chunks - The embedding to seed the database with.
 * @param {number} batchSize - The size of each batch to insert (default is 500).
 */
export const seedSingleDb = async (pg: PGliteWorker, chunks: any[], batchSize = 500) => {
    console.log("Seeding DB: ", chunks);
    const t1 = performance.now();
    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const values = batch.map((embedding, index) =>
            `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`
        ).join(", ");

        const params = batch.flatMap(embedding => [embedding.content.page, embedding.content.index, embedding.content.text, JSON.stringify(embedding.embedding)]);

        await pg.query(
            `
            INSERT INTO chunks (page_id, chunk_id, content, embedding)
            VALUES ${values};
            `,
            params
        );
    }
    const t2 = performance.now();
    console.log(`DB seed completed in ${((t2 - t1) / 1000).toFixed(2)} seconds`);
}

/**
 * Searches the database for chunks matching a query.
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 * @param {any[]} embedding - The embedding to search for.
 * @param {string} query - The query to search for.
 * @param {number} match_threshold - The threshold for matching (default is 0.8).
 * @param {number} limit - The maximum number of results to return (default is 3).
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
          select * from chunks
          where chunks.embedding <#> $1 < $2
          order by chunks.embedding <#> $1
          limit $3;
          `,
        [JSON.stringify(embedding), -Number(match_threshold), Number(limit)],
    );

    const bm25Results = await pg.query(
        `
      select *, ts_rank_cd(to_tsvector(content), plainto_tsquery($1)) as rank
      from chunks
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
 * Searches the database for chunks matching a query and page number.
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 * @param {string} query - The query to search for.
 * @param {number} page - The page number to search for.
 * @param {number} limit - The maximum number of results to return (default is 3).
 */
export const searchWithPage = async (
    pg: PGliteWorker,
    query: string,
    page: number,
    limit = 3,
) => {
    const results = await pg.query(
        `
        select * from chunks
        where chunks.page_id = $1
        `,
        [page],
    );

    const bm25Results = await pg.query(
        `
      select *, ts_rank_cd(to_tsvector(content), plainto_tsquery($1)) as rank
      from chunks
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
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 * @returns {Promise<number>} The total number of pages.
 */
export const getTotalPages = async (pg: PGliteWorker) => {
    const totalPages: any = await pg.query(`SELECT MAX(page_id) FROM chunks`);
    return totalPages.rows[0].max;
}

/**
 * Retrieves the total number of chunks in the database.
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 * @returns {Promise<number>} The total number of chunks.
 */
export const getTotalChunks = async (pg: PGliteWorker) => {
    const totalChunks: any = await pg.query(`SELECT COUNT(*) FROM chunks`);
    return totalChunks.rows[0].count;
}