import { useState, useRef, useEffect, useCallback } from 'react';
import { WorkerMessageEvent } from '@/utils/interfaces';
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button"
import { Loader2, Copy, Download, Share } from 'lucide-react'
import { Textarea } from "@/components/ui/textarea"

import { getDB, initSchema, countRows } from '@/utils/db/db-helper';
import { search, searchWithPage } from '@/utils/db/db-documents';
import { getRootRules } from '@/utils/db/db-rules';
import { RuleNode, RulesEngine } from '@/utils/rete-network';
import { timeSince } from '@/utils/helpers';

import '@/App.css';

import ChatWorker from '@/workers/worker.js?worker';

type Message = {
  role: 'user' | 'assistant'
  content?: string
}

type PromptHistory = {
  prompt: string;
  timestamp: Date;
}

const Home: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [documentContext, setDocumentContext] = useState<string>('');
  const [answerResult, setAnswerResult] = useState<any>('');
  const initailizing = useRef<boolean>(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [promptHistory, setPromptHistory] = useState<PromptHistory[]>([]);

  const worker = useRef<Worker | null>(null);
  const db = useRef<any>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!prompt.trim()) return

    setPromptHistory(prevHistory => [...prevHistory, { prompt: prompt, timestamp: new Date() }]);
    console.log("Input: ", prompt);

    // const userMessage: Message = { role: 'user', content: input }
    // setMessages(prevMessages => [...prevMessages, userMessage])
    setIsLoading(true)

    if (worker.current) {
      setAnswerResult(null);
      setDocumentContext('');
      const pages = await checkRules(prompt);
      if (pages) {
        await worker.current.postMessage({ type: "search_with_pages", data: { query: prompt, pages: pages } });
      } else {
        await worker.current.postMessage({ type: "search", data: { query: prompt } });
      }
    }
  }



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
  }, [db.current]);

  useEffect(() => {
    if (!worker.current) {
      worker.current = new ChatWorker();
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
            console.log("Search Input: ", e.data.query);
            const searchResults = await search(db.current, e.data.embedding, e.data.query);
            console.log("Risultati: ", searchResults);
            setDocumentContext(searchResults.map((result: any) => result.content).join('\n'));
            const retrieved_pages = searchResults.map((result: any) => result.page_id).join(', ');
            worker.current?.postMessage({
              type: 'generate_text',
              data: {
                query: e.data.query,
                context: "Pages:" + retrieved_pages + "\n\n" + searchResults.join('\n'),
              },
            });
            setInput('');
            break;
          }
        case "search_with_pages_complete":
          {
            console.log("Found pages: ", e.data.pages);
            if (e.data.pages) {
              const searchResults = await searchWithPage(db.current, e.data.query, e.data.pages);
              const retrieved_pages = searchResults.map((result: any) => result.page_id).join(', ');
              console.log("Search results: ", searchResults);
              worker.current?.postMessage({
                type: 'generate_text',
                data: {
                  query: e.data.query,
                  context: "Pages:" + retrieved_pages + "\n\n" + searchResults.join('\n'),
                },
              });
            }
            break;
          }
        case "text_generation_complete": {
          setAnswerResult(e.data.output);
          if (e.data.isFinal) {
            setIsLoading(false)
          }
          break;
        }
      }
    };

    worker.current.addEventListener("message", onMessageReceived);

    return () => {
      worker.current?.removeEventListener("message", onMessageReceived);
    };
  }, [prompt]);

  const checkRules = async (query: string) => {
    const rules = await getRootRules(db.current);
    const engine = new RulesEngine();
    rules.forEach((rule: RuleNode) => engine.addRootRule(rule));
    try {
      return engine.evaluate({ query: query });
    } catch (error) {
      console.error('Error evaluating rules: ', error);
      return [];
    }
  }

  return (
    <div className="app-container hidden space-y-6 p-10 pb-16 md:block">
      <div className="space-y-0.5">
        <h2 className="text-2xl font-bold tracking-tight">DocuGenie</h2>
        <p className="text-muted-foreground">
          Your personal assistant for document analysis.
        </p>
      </div>
      <Separator className="my-6" />
      <main className="w-full">
        <div className="flex-1 overflow-auto p-6 w-full">
          <div className="max-w-3xl mx-auto grid gap-8">
            <div>
              <form onSubmit={handleSubmit} className="grid gap-2">
                <Textarea
                  placeholder="Enter your prompt here..."
                  className={`${isLoading ? 'bg-muted' : ''} text-foreground rounded-lg p-4 text-lg font-medium resize-none`}
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setPrompt('')}>Clear</Button>
                  <Button type="submit" disabled={isLoading || !prompt.trim()}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}</Button>
                </div>
              </form>
            </div>
            <div className="grid gap-4">
              <div className="bg-muted rounded-lg p-4">
                <h2 className="text-lg font-medium mb-2">Model Output</h2>
                <div className="prose text-foreground">
                  <p>
                    {answerResult}
                  </p>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button data-testid="copy-button" variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(answerResult)}>
                    <Copy className="w-5 h-5" />
                    <span className="sr-only">Copy</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => {
                    const a = document.createElement('a');
                    a.href = `data:text/plain,${answerResult}`;
                    a.download = 'docugenie-answer.txt';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}>
                    <Download className="w-5 h-5" />
                    <span className="sr-only">Download</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => navigator.share({ title: "DocuGenie", text: answerResult })}>
                    <Share className="w-5 h-5" />
                    <span className="sr-only">Share</span>
                  </Button>
                </div>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <h2 className="text-lg font-medium mb-2">History</h2>
                <div className="grid gap-2">
                  {
                    promptHistory.map((prompt, index) => {
                      return (
                        <div className="flex items-center gap-2 p-2 rounded-md hover:bg-background" key={index}>
                          <div className="text-sm font-medium">{prompt.prompt}</div>
                          <div className="text-sm text-muted-foreground">{timeSince(prompt.timestamp) + " ago"}</div>
                          <div className="flex-1" />
                          <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(prompt.prompt)}>
                            <Copy className="w-5 h-5" />
                            <span className="sr-only">Copy</span>
                          </Button>
                        </div>
                      )
                    })
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
