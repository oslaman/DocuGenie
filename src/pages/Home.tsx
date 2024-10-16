import { useState, useRef, useEffect, useCallback } from 'react';
import { getDB, initSchema, countRows, search } from '../utils/db';
import { InputDialogue } from "@/components/InputDialogue";


import '../App.css';

interface WorkerMessageEvent extends MessageEvent {
    data: {
      status: string;
      embedding?: any;
      output?: { content: string };
    };
  }

const Home: React.FC = () => {
    const [prompt, setPrompt] = useState<string>('');
    const [documentContext, setDocumentContext] = useState<string>('');
    const [answerResult, setAnswerResult] = useState<any>('');
    const initailizing = useRef<boolean>(false);
  
    const worker = useRef<Worker | null>(null);
    const db = useRef<any>(null);
  
    useEffect(() => {
      const setup = async () => {
        initailizing.current = true;
        db.current = await getDB();
        await initSchema(db.current);
        const count = await countRows(db.current, "embeddings");
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
          case "text_generation_complete": {
            setAnswerResult(e.data.output);
            break;
          }
        }
      };
  
      worker.current.addEventListener("message", onMessageReceived);
  
      return () => {
        worker.current?.removeEventListener("message", onMessageReceived);
      };
    }, [prompt]);

    const classify = useCallback((text: string) => {
        if (worker.current) {
          setAnswerResult(null);
          setDocumentContext('');
          worker.current.postMessage({ type: "search", data: { query: text } });
        }
      }, []);
  
    return (
        <div className="app-container">
        <main className="app-main">
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
            <p className="leading-7 [&:not(:first-child)]:mt-6">
              {answerResult}
            </p>
          </section>
        </main>
      </div>
    );
};

export default Home;