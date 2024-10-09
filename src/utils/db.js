import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

let dbInstance;

export async function getDB() {
    if (dbInstance) {
        return dbInstance;
    }
    const metaDb = new PGlite("idb://rag-app", {
        extensions: {
            vector,
            pg_trgm,
        },
    });
    await metaDb.waitReady;
    dbInstance = metaDb;
    return metaDb;
}

export const initSchema = async (db) => {
    await db.exec(`
      create extension if not exists vector;
      create extension if not exists pg_trgm; -- Per BM25
      drop table if exists embeddings;

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

export const countRows = async (db, table) => {
    const res = await db.query(`SELECT COUNT(*) FROM ${table};`);
    return (res.rows[0]).count;
};

export const seedDb = async (db, embeddings) => {
    console.log("Seeding DB: ", embeddings);
    const t1 = performance.now();
    for (const embedding of embeddings) {
        await db.query(
            `
                    insert into embeddings (page_id, chunk_id, content, embedding)
                    values ($1, $2, $3, $4);
                `,
            [embedding.page, embedding.index, embedding.text, JSON.stringify(embedding.embedding_of_chunk)]
        );
    }
    const t2 = performance.now();
    console.log("DB seed complete");
    console.log(`Time taken: ${(t2 - t1) / 1000} seconds`);
}

export const seedSingleDb = async (db, embeddings) => {
    console.log("Seeding DB: ", embeddings);
    const t1 = performance.now();
    for (const embedding of embeddings) {
        await db.query(
            `
                    insert into embeddings (page_id, chunk_id, content, embedding)
                    values ($1, $2, $3, $4);
                `,
            [embedding.content.page, embedding.content.index, embedding.content.text, JSON.stringify(embedding.embedding)]
        );
    }
    const t2 = performance.now();
    console.log("DB seed complete");
    console.log(`Time taken: ${(t2 - t1) / 1000} seconds`);
}



export const search = async (
    db,
    embedding,
    query,
    match_threshold = 0.8,
    limit = 3,
) => {
    const vectorResults = await db.query(
        `
      select * from embeddings
      where embeddings.embedding <#> $1 < $2
      order by embeddings.embedding <#> $1
      limit $3;
      `,
        [JSON.stringify(embedding), -Number(match_threshold), Number(limit)],
    );

    const bm25Results = await db.query(
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

export const clearDb = async (db) => {
    await db.query(`truncate table embeddings;`);
};

export const getDbData = async (db) => {
    const res = await db.query(`SELECT * FROM embeddings;`);
    return res.rows;
};