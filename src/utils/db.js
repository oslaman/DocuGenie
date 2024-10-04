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
    return await db.exec(`
      create extension if not exists vector;
      create extension if not exists pg_trgm; -- Per BM25
      drop table if exists embeddings;

      create table if not exists embeddings (
        id bigint primary key generated always as identity,
        content text not null,
        embedding vector (384)
      );

      create index on embeddings using hnsw (embedding vector_ip_ops);
      create index on embeddings using gin (content gin_trgm_ops); -- Index per BM25
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
