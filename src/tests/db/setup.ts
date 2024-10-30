import { vi, beforeEach, afterEach, afterAll, expect } from "vitest";
import { PGlite } from '@electric-sql/pglite'
import DbWorker from '@/workers/pglite-worker.js?worker';
import { PGliteWorker } from "@electric-sql/pglite/worker";
import { getDB, initSchema } from "@/utils/db/db-helper";
import matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';

vi.mock("@/utils/db/db-helper", async (importOriginal) => {
    const db = new PGliteWorker(
        new DbWorker(),
        {
            dataDir: 'idb://rag-app',
        }
    )
    const pg = new PGlite(db);
    await db.waitReady;
    return {
        ...(await importOriginal<typeof import("@/utils/db/db-helper")>()),
        db,
        pg,
    };
});

// initialize db before each test
beforeEach(async () => {
    const db = await getDB();
    await initSchema(db);
});

// clean up db after each test
afterEach(async () => {
    const db = await getDB();
    await db.exec('DROP TABLE IF EXISTS embeddings');
    await db.exec('DROP TABLE IF EXISTS rules');
});

// free up resources after all tests are done
afterAll(async () => {
    const db = await getDB();
    await db.close();
});

afterEach(() => {
    cleanup();
});

expect.extend(matchers);