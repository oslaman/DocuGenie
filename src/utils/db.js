import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";

let dbInstance;

export async function getDB() {
    if (dbInstance) {
        return dbInstance;
    }
    const metaDb = new PGlite("idb://rag-app", {
        extensions: {
            vector,
        },
    });
    await metaDb.waitReady;
    dbInstance = metaDb;
    return metaDb;
}

export const initSchema = async (db) => {
    return await db.exec(`
      create extension if not exists vector;
      -- drop table if exists embeddings; -- Uncomment to reset the database
      create table if not exists embeddings (
        id bigint primary key generated always as identity,
        content text not null,
        embedding vector (384)
      );
      
      create index on embeddings using hnsw (embedding vector_ip_ops);
    `);
};

export const countRows = async (db, table) => {
    const res = await db.query(`SELECT COUNT(*) FROM ${table};`);
    return res.rows[0].count;
};

export const seedDb = async (db, embeddings) => {
    console.log("Embeddings: ", embeddings);
    for (const embedding of embeddings) {
        await db.query(
            `
        insert into embeddings (content, embedding)
        values ($1, $2);
      `,
            [embedding.content, JSON.stringify(embedding.embedding)],
        );
    }
    console.log(await countRows(db, "embeddings"));
}

// Cosine similarity search in pgvector
export const search = async (
    db,
    embedding,
    match_threshold = 0.8,
    limit = 3,
) => {
    const res = await db.query(
        `
      select * from embeddings
      -- The inner product is negative, so we negate match_threshold
      where embeddings.embedding <#> $1 < $2
  
      -- Our embeddings are normalized to length 1, so cosine similarity
      -- and inner product will produce the same query results.
      -- Using inner product which can be computed faster.
      order by embeddings.embedding <#> $1
      limit $3;
      `,
        [JSON.stringify(embedding), -Number(match_threshold), Number(limit)],
    );
    return res.rows;
};
