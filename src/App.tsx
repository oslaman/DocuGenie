import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getDB, initSchema, countRows, seedDb, seedSingleDb, search, clearDb, getDbData } from './utils/db';
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { InputDialogue } from "@/components/InputDialogue";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { Progress } from "@/components/ui/progress";
import { recursiveChunkingWithPages, TextWithPage } from './utils/chunking';

import './App.css';

interface WorkerMessageEvent extends MessageEvent {
  data: {
    status: string;
    embedding?: any;
    output?: { content: string };
  };
}

function App() {
  const [prompt, setPrompt] = useState<string>('');
  const [progress, setProgress] = React.useState(0);
  const [dbRows, setDbRows] = useState<number>(0);
  const [documentContext, setDocumentContext] = useState<string>('');
  const [answerResult, setAnswerResult] = useState<string | null>(null);
  const initailizing = useRef<boolean>(false);

  const worker = useRef<Worker | null>(null);
  const db = useRef<any>(null);
  const pg = useRef<any>(null);

  useEffect(() => {
    const setup = async () => {
      initailizing.current = true;
      db.current = await getDB();
      await initSchema(db.current);
      const count = await countRows(db.current, "embeddings");
      setDbRows(count);
      console.log(`Found ${count} rows`);
    };
    if (!db.current && !initailizing.current) {
      setup();
    }
  }, []);

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL("./worker.js", import.meta.url), {
        type: "module",
      });
    }

    const onMessageReceived = async (e: WorkerMessageEvent) => {
      switch (e.data.status) {
        case "initiate":
          break;
        case "ready":
          break;
        case "search_complete":
          {
            console.log("Embedding: ", e.data.embedding);
            console.log("Search Input: ", prompt);
            const searchResults = await search(db.current, e.data.embedding, prompt);
            console.log("Risultati: ", searchResults);
            setDocumentContext(searchResults.map((result: any) => result.content).join('\n'));
            const retrieved_pages = searchResults.map((result: any) => result.page_id).join(', ');
            worker.current?.postMessage({
              type: 'generate_text',
              data: {
                query: prompt,
                context: "Pages:" + retrieved_pages + "\n\n" + searchResults.map((result: any) => result.content).join('\n'),
              },
            });
            break;
          }
        case "embedding_complete": {
          setProgress(0);
          const result = e.data.output;
          console.log("Result: ", result)
          await seedSingleDb(db.current, result as any);
          const count = await countRows(db.current, "embeddings");
          setDbRows(count);
          break;
        }
        case "text_generation_complete": {
          setAnswerResult(e.data.output?.content || '');
          break;
        }
      }
    };

    worker.current.addEventListener("message", onMessageReceived);

    return () => {
      worker.current?.removeEventListener("message", onMessageReceived);
    };
  }, [prompt]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const json = JSON.parse(e.target?.result as string);
      console.log(json)
      const chunks = json.chunks;
      worker.current?.postMessage({
        type: 'process_chunks',
        data: { chunks },
      });
    };

    reader.readAsText(file);
  };

  const handleEmbeddingsUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const t0 = performance.now();
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const json = JSON.parse(content);
        const embeddings = json.chunks;
        const elements = embeddings.length;
        setProgress(0);
        for (let i = 0; i < embeddings.length; i++) {
          const embedding = embeddings[i];
          await seedDb(db.current, [embedding]);
          setProgress((i + 1) / elements * 100);
        }
        setProgress(100);
        console.log("Upload complete");
        const t1 = performance.now();
        console.log(`Time taken for uploading: ${((t1 - t0) / 1000).toFixed(2)} seconds`);
        const rows = await countRows(db.current, "embeddings");
        setDbRows(rows);
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
      }
    };

    reader.onerror = (error) => {
      console.error(`Error reading file ${file.name}:`, error);
    };

    reader.readAsText(file);
  };

  const classify = useCallback((text: string) => {
    if (worker.current) {
      setAnswerResult(null);
      setDocumentContext('');
      worker.current.postMessage({ type: "search", data: { query: text } });
    }
  }, []);

  async function handleMultipleEmbeddingsUpload(event: React.ChangeEvent<HTMLInputElement>) {
    event.preventDefault();
    console.log("Dati db: ", await getDbData(db.current));
    const files = Array.from(event.target.files || []);
    console.log(files)
    const totalFiles = files.length;
    setProgress(0);

    const t1 = performance.now();

    for (let index = 0; index < totalFiles; index++) {
      const file = files[index];
      if (file instanceof File) {
        await processFile(file);
        setProgress((index + 1) / totalFiles * 100);
      }
    }

    setProgress(100);
    console.log("Upload complete");
    const rows = await countRows(db.current, "embeddings");
    setDbRows(rows);

    const t2 = performance.now();
    console.log(`Time taken for uploading: ${((t2 - t1) / 1000).toFixed(2)} seconds`);
  }

  function processFile(file: File) {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const embedding = JSON.parse(content);

          if (embedding && typeof embedding === 'object') {
            await seedDb(db.current, [embedding]);
          } else {
            console.error(`File ${file.name} does not contain a valid embedding object.`);
          }
          resolve();
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          reject(error);
        }
      };

      reader.onerror = (error) => {
        console.error(`Error reading file ${file.name}:`, error);
        reject(error);
      };

      reader.readAsText(file);
    });
  }

  const handlePagesUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const jsonData = JSON.parse(content);

        const textWithPages: TextWithPage[] = jsonData.document_body.map((entry: any) => ({
          text: entry.text,
          pageNumber: entry.page
        }));

        const chunks = await recursiveChunkingWithPages(textWithPages, 800, 300);
        console.table(chunks);

        worker.current?.postMessage({
          type: 'process_chunks',
          data: { chunks },
        });
      } catch (error) {
        console.error("Error parsing JSON or processing chunks:", error);
      }
    };

    reader.readAsText(file);
  };

  const cleanDatabase = async () => {
    try {
      await clearDb(db.current);
      setDbRows(0);
      setDocumentContext('');
      setAnswerResult(null);
    } catch (error) {
      console.error("Error clearing the database:", error);
    }
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="app-container">
        <nav className='w-full flex justify-end'><ModeToggle /></nav>
        <main className="app-main">
          <section className="dashboard-container w-full flex flex-row gap-4">
            <div className='flex flex-col gap-4 w-full'>
              <div className="file-upload">
                <Label htmlFor="pages-upload">Upload text pages</Label>
                <Input type="file" id="pages-upload" onChange={handlePagesUpload} />
              </div>
              <div className="file-upload">
                <Label htmlFor="file-upload">Upload File</Label>
                <Input type="file" id="file-upload" onChange={handleFileUpload} />
              </div>
              <div className="file-upload">
                <Label htmlFor="embeddings-upload">Upload Embeddings</Label>
                <Input type="file" id="embeddings-upload" multiple onChange={handleEmbeddingsUpload} />
              </div>
              <div className="file-upload">
                <Label htmlFor="embeddings-upload">Upload Multiple Embeddings</Label>
                <Input type="file" id="embeddings-upload" multiple onChange={handleMultipleEmbeddingsUpload} />
              </div>
              <Progress value={progress} />
            </div>
            <Card
              className="max-w-xs h-fit w-full" x-chunk="charts-01-chunk-3"
            >
              <CardHeader className="p-4 pb-0">
                <CardTitle>Database Info</CardTitle>
                <CardDescription>
                  Embeddings elements in the database
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-row items-baseline gap-4 p-4 pt-0 w-full">
                <div className="flex items-baseline gap-1 text-3xl font-bold tabular-nums leading-none">
                  {dbRows}
                  <span className="text-sm font-normal text-muted-foreground">
                    db rows
                  </span>
                </div>
                <Button onClick={cleanDatabase}>Clear Database</Button>
              </CardContent>
            </Card>
          </section>
          <section className="search-section">
            <InputDialogue
              prompt={prompt}
              setPrompt={setPrompt}
              classify={classify as (text: string) => Promise<void>}
            />
          </section>
          <section className="results-section">
            <div className='my-6'>
              <blockquote className="mt-6 border-l-2 pl-6 italic">
                {documentContext}
              </blockquote>
            </div>
            <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">Answer</h2>
            <div className="answer-result" style={{ whiteSpace: 'pre-wrap' }}>
              {answerResult}
            </div>
          </section>
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;