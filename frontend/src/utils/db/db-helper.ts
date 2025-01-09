import { PGliteWorker } from "@electric-sql/pglite/worker";
import DbWorker from '@/workers/pglite-worker.ts?worker';


let dbInstance: PGliteWorker | null = null;

/**
 * Retrieves the PGliteWorker instance.
 * @returns {Promise<PGliteWorker>} The PGliteWorker instance.
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
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 */
export const initSchema = async (pg: PGliteWorker) => {
    await pg.exec(`
      create extension if not exists vector;
      create extension if not exists pg_trgm; -- Per BM25
      create extension if not exists ltree;
      create extension if not exists adminpack;

      -- drop table if exists chunks;
      -- drop table if exists rules;

      create table if not exists chunks (
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

      -- Create indexes for the chunks table
      create index if not exists chunks_hnsw on chunks using hnsw (embedding vector_ip_ops);
      create index if not exists chunks_gin on chunks using gin (content gin_trgm_ops); -- trigram matching
      create index if not exists chunks_fts_idx ON chunks USING gin (to_tsvector('english', content)); -- full-text search
    `);
};

/**
 * Counts the number of rows in a table.
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 * @param {string} table - The name of the table to count the rows of.
 * @returns {Promise<number>} The number of rows in the table.
 */
export const countRows = async (pg: PGliteWorker, table: string) => {
    const res = await pg.query(`SELECT COUNT(*) FROM ${table};`);
    return (res.rows[0] as { count: number }).count;
};

/**
 * Clears the database and reinitializes the schema.
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 */
export const clearDb = async (pg: PGliteWorker) => {
    await pg.query(`truncate table chunks cascade;`);
    await pg.query(`truncate table rules cascade;`);
    await initSchema(pg);
};

/**
 * Clears a table and reinitializes the schema.
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 * @param {string} table - The name of the table to clear.
 */
export const clearTable = async (pg: PGliteWorker, table: string) => {
    await pg.query(`truncate table ${table} cascade;`);
    await initSchema(pg);
};

/**
 * Retrieves all data from the chunks table.
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 * @returns {Promise<any[]>} The data from the chunks table.
 */
export const getDbData = async (pg: PGliteWorker) => {
    const res = await pg.query(`SELECT * FROM chunks;`);
    return res.rows;
};

/**
 * Retrieves the size of the database in bytes.
 * @param {PGliteWorker} pg - The PGliteWorker instance.
 * @returns {Promise<number>} The size of the database in bytes.
 */
export const getDbSizeInBytes = async (pg: PGliteWorker) => {
    const databaseName = (await pg.query<{ current_database: string }>('SELECT current_database();')).rows[0].current_database;
    const res = await pg.query<{ pg_database_size: number }>(`SELECT pg_database_size('${databaseName}');`);

    return res.rows[0].pg_database_size;
};