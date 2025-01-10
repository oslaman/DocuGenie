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
 * Enhanced search function implementing RAGFusion
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 * @param {any[]} embedding - The embedding to search for.
 * @param {string} query - The query to search for.
 * @param {number} match_threshold - The threshold for matching (default is 0.8).
 * @param {number} limit - The maximum number of results to return (default is 5).
 * @returns {Promise<any[]>} The search results.
 */
export const searchWithFusion = async (
    pg: PGliteWorker,
    embedding: any[],
    query: string,
    match_threshold = 0.8,
    limit = 5,
) => {
    const vectorResults = await pg.query(
        `
        select *, chunks.embedding <#> $1 as distance
        from chunks
        where chunks.embedding <#> $1 < $2
        order by chunks.embedding <#> $1
        limit $3;
        `,
        [JSON.stringify(embedding), -Number(match_threshold), Number(limit)],
    );

    const keywordResults = await pg.query(
        `
        select *,
            (ts_rank_cd(to_tsvector(content), plainto_tsquery($1)) + 
             similarity(content, $1)) as rank
        from chunks
        where to_tsvector(content) @@ plainto_tsquery($1) 
           or content % $1
        order by rank desc
        limit $2;
        `,
        [query, Number(limit)],
    );

    // Reciprocal Rank Fusion
    const fusedResults = fuseResults(
        vectorResults.rows,
        keywordResults.rows,
        limit
    );

    return fusedResults.map((result: any) => ({
        content: `- ${result.content}`,
        page_id: result.page_id,
        score: result.fused_score
    }));
};

/**
 * Implements Reciprocal Rank Fusion
 * @param {any[]} semanticResults - The semantic search results.
 * @param {any[]} keywordResults - The keyword search results.
 * @param {number} k - The fusion constant (default is 60).
 * @returns {any[]} The fused results.
 */
export function fuseResults(
    semanticResults: any[],
    keywordResults: any[],
    k: number = 60
): any[] {
    const scores = new Map<string, number>();
    const documents = new Map<string, any>();

    semanticResults.forEach((doc, rank) => {
        const id = `${doc.page_id}-${doc.chunk_id}`;
        documents.set(id, doc);
        scores.set(id, 1 / (rank + k));
    });

    keywordResults.forEach((doc, rank) => {
        const id = `${doc.page_id}-${doc.chunk_id}`;
        documents.set(id, doc);
        const existingScore = scores.get(id) || 0;
        scores.set(id, existingScore + 1 / (rank + k));
    });

    return Array.from(documents.entries())
        .map(([id, doc]) => ({
            ...doc,
            fused_score: scores.get(id) || 0
        }))
        .sort((a, b) => b.fused_score - a.fused_score);
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

    /**
     * Search for chunks using vector similarity
     * <#> is a system operator for computing the inner product of two vectors. 
     * It determines whether the vectors point in the same or opposite directions.
     * The inner product is negative, because PostgreSQL only supports ASC order index scans on operators.
     * @see https://github.com/pgvector/pgvector?tab=readme-ov-file#querying
    */
    vectorResults = await pg.query(
        `
          select * from chunks
          where chunks.embedding <#> $1 < $2
          order by chunks.embedding <#> $1
          limit $3;
          `,
        [JSON.stringify(embedding), -Number(match_threshold), Number(limit)],
    );

    /**
     * Search for chunks using pg_trgm
     * ts_rank_cd is a system function for computing a score showing how well a tsvector matches a tsquery
     * to_tsvector converts the text into a vector of words, ignoring stop words
     * plainto_tsquery converts the query into a vector of words
     * @@ is a boolean operator that checks if the query is a subset of the text
     * these operators are built-in operators provided by postgres
     */
    const searchResults = await pg.query(
        `
      select *, 
               (ts_rank_cd(to_tsvector(content), plainto_tsquery($1)) + 
                similarity(content, $1)) as rank
        from chunks
        where to_tsvector(content) @@ plainto_tsquery($1) 
           or content % $1
        order by rank desc
        limit $2;
      `,
        [query, Number(limit)],
    );

    const combinedResults = [...vectorResults.rows, ...searchResults.rows]
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

    const textResults = await pg.query(
        `
        SELECT *, 
               (ts_rank_cd(to_tsvector(content), plainto_tsquery($1)) + 
                similarity(content, $1)) as rank
        FROM chunks
        WHERE to_tsvector(content) @@ plainto_tsquery($1) 
           OR content % $1
        ORDER BY rank DESC
        LIMIT $2;
        `,
        [query, Number(limit)],
    );

    const combinedResults = [...results.rows, ...textResults.rows]
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