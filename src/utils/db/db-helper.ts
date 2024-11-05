import { PGliteWorker } from "@electric-sql/pglite/worker";
import DbWorker from '@/workers/pglite-worker.js?worker';


let dbInstance: PGliteWorker | null = null;

/**
 * Retrieves the PGliteWorker instance.
 * @returns The PGliteWorker instance.
 */
export async function getDB() {
    if (dbInstance) {
        return dbInstance;
    }
    const pg = new PGliteWorker(
        new DbWorker(),
        {
            dataDir: 'idb://rag-app',
        }
    )

    await pg.waitReady;
    dbInstance = pg;

    return pg;
}

/**
 * Initializes the schema for the database.
 * @param pg - The PGliteWorker instance.
 */
export const initSchema = async (pg: PGliteWorker) => {
    await pg.exec(`
      create extension if not exists vector;
      create extension if not exists pg_trgm; -- Per BM25
      create extension if not exists ltree;
      create extension if not exists adminpack;

      -- drop table if exists embeddings;
      -- drop table if exists rules;
      drop table if exists foo;

      create table if not exists embeddings (
        id bigint primary key generated always as identity,
        page_id integer,
        chunk_id integer,
        content text not null,
        embedding vector (384)
      );

      create table if not exists rules (
        id serial primary key,
        name text not null,
        conditions text not null,
        page integer not null,
        prompt text not null,
        salience integer not null,
        parent_id integer references rules(id),
        created_at timestamp default current_timestamp
      );

      create index on embeddings using hnsw (embedding vector_ip_ops);
      create index on embeddings using gin (content gin_trgm_ops); -- Index per BM25
    `);
};

/**
 * Counts the number of rows in a table.
 * @param pg - The PGliteWorker instance.
 * @param table - The name of the table to count the rows of.
 * @returns The number of rows in the table.
 */
export const countRows = async (pg: PGliteWorker, table: string) => {
    const res = await pg.query(`SELECT COUNT(*) FROM ${table};`);
    return (res.rows[0] as { count: number }).count;
};

/**
 * Clears the database and reinitializes the schema.
 * @param pg - The PGliteWorker instance.
 */
export const clearDb = async (pg: PGliteWorker) => {
    await pg.query(`drop table if exists embeddings;`);
    await pg.query(`drop table if exists rules;`);
    await initSchema(pg);
};

/**
 * Retrieves all data from the embeddings table.
 * @param pg - The PGliteWorker instance.
 * @returns The data from the embeddings table.
 */
export const getDbData = async (pg: PGliteWorker) => {
    const res = await pg.query(`SELECT * FROM embeddings;`);
    return res.rows;
};

/**
 * Retrieves the size of the database in bytes.
 * @param pg - The PGliteWorker instance.
 * @returns The size of the database in bytes.
 */
export const getDbSizeInBytes = async (pg: PGliteWorker) => {
    const databaseName = (await pg.query<{ current_database: string }>('SELECT current_database();')).rows[0].current_database;
    const res = await pg.query<{ pg_database_size: number }>(`SELECT pg_database_size('${databaseName}');`);

    return res.rows[0].pg_database_size;
};