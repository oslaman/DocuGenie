import { PGliteWorker } from "@electric-sql/pglite/worker";

let dbInstance;

export async function getDB() {
    if (dbInstance) {
        return dbInstance;
    }
    const pg = new PGliteWorker(
        new Worker(new URL('./pglite-worker.js', import.meta.url), {
          type: 'module',
        }),
        {
          dataDir: 'idb://rag-app',
        }
      )
    
    await pg.waitReady;
    dbInstance = pg;
    return pg;
}

export const initSchema = async (pg) => {
    await pg.exec(`
      create extension if not exists vector;
      create extension if not exists pg_trgm; -- Per BM25
      -- drop table if exists embeddings;

      create table if not exists embeddings (
        id bigint primary key generated always as identity,
        page_id integer,
        chunk_id integer,
        content text not null,
        embedding vector (384)
      );

      create index on embeddings using hnsw (embedding vector_ip_ops);
      create index on embeddings using gin (content gin_trgm_ops); -- Index per BM25
    `);
};

export const countRows = async (pg, table) => {
    const res = await pg.query(`SELECT COUNT(*) FROM ${table};`);
    return (res.rows[0]).count;
};

export const seedDb = async (db, embeddings, batchSize = 500) => {
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

        await db.query(
            `
            INSERT INTO embeddings (page_id, chunk_id, content, embedding)
            VALUES ${values};
            `,
            params
        );
    }
}

export const seedSingleDb = async (db, embeddings, batchSize = 500) => {
    console.log("Seeding DB: ", embeddings);
    const t1 = performance.now();
    for (let i = 0; i < embeddings.length; i += batchSize) {
        const batch = embeddings.slice(i, i + batchSize);
        const values = batch.map((embedding, index) => 
            `($${index * 4 + 1}, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4})`
        ).join(", ");
        
        const params = batch.flatMap(embedding => [embedding.content.page, embedding.content.index, embedding.content.text, JSON.stringify(embedding.embedding)]);

        await db.query(
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
    pg,
    embedding,
    query,
    match_threshold = 0.8,
    limit = 3,
) => {
    const vectorResults = await pg.query(
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
        .sort((a, b) => (a.distance || 0) - (b.distance || 0) + (b.rank || 0) - (a.rank || 0))
        .slice(0, limit);

    return combinedResults;
};

export const clearDb = async (pg) => {
    await pg.query(`drop table if exists embeddings;`);
    await initSchema(pg);
};

export const getDbData = async (pg) => {
    const res = await pg.query(`SELECT * FROM embeddings;`);
    return res.rows;
};