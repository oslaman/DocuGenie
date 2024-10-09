import { describe, expect, test, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "@/App";
import { getDB, initSchema, countRows, seedDb } from "@/utils/db";
import MyWorker from '../worker?worker'


const worker = new MyWorker();
const db = await getDB();


vi.mock("@/utils/db", () => ({
  getDB: vi.fn(),
  initSchema: vi.fn(),
  countRows: vi.fn(),
  seedDb: vi.fn(),
}));

describe("App Component", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await initSchema(db);
    vi.mocked(countRows).mockResolvedValue(0);
  });

  test("uploads a file and checks the database row count", async () => {
    render(<App />);

    const file = new File(
      [JSON.stringify({ chunks: [{ text: "sample text", page: 1, index: 0, embedding_of_chunk: [0.1, 0.2, 0.3] }] })],
      "sample.json",
      { type: "application/json" }
    );

    const fileInput = screen.getByLabelText(/Upload Embeddings/i);
    fireEvent.change(fileInput, { target: { files: [file] } });

    await seedDb(db, [{ text: "sample text", page: 1, index: 0, embedding_of_chunk: [0.1, 0.2, 0.3] }]);
    const dbRows = await countRows(db, "embeddings");
    expect(screen.getByText(/1 db rows/i)).toBeDefined();
  });

  test("clears the database", async () => {
    render(<App />);
    const clearButton = screen.getByText(/Clear Database/i);
    fireEvent.click(clearButton);
    const dbRows = await countRows(db, "embeddings");
    expect(dbRows).toBe(0);
  });

  test("searches for a query and waits for llm worker answer", async () => {
    render(<App />);
    const searchInput = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(searchInput, { target: { value: "sample text" } });
    worker.onmessage = function(event) {
        if (event.data.status === 'embedding_complete') {
          console.log('Worker task completed');
        }
    };
  });
});
