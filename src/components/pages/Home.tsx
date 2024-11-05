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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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
  const [userInput, setUserInput] = useState<string>('');
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
    if (!userInput.trim()) return

    setPromptHistory(prevHistory => [...prevHistory, { prompt: userInput, timestamp: new Date() }]);
    console.log("Input: ", userInput);

    setIsLoading(true)

    if (worker.current) {
      setAnswerResult(null);
      setDocumentContext('');
      const ragPrompt: { prompt: string, page: number } | undefined = await checkRules(userInput);

      const messageData = {
        query: userInput,
        ...(ragPrompt?.prompt && ragPrompt.prompt.trim().length > 0 && { prompt: ragPrompt.prompt }),
        ...(ragPrompt?.page && ragPrompt.page > 0 && { page: ragPrompt.page }),
      };

      if (ragPrompt) {
        await worker.current.postMessage({ type: "search", data: messageData });
      } else {
        await worker.current.postMessage({ type: "search", data: { query: userInput } });
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
            console.log("Page: ", e.data.page);
            console.log("Prompt: ", e.data.prompt);
            let searchResults;

            if (e.data.page) {
              searchResults = await searchWithPage(db.current, e.data.query, e.data.page);
            } else {
              searchResults = await search(db.current, e.data.embedding, e.data.query);
            }

            console.log("Risultati: ", searchResults);
            const retrieved_pages = searchResults.map((result: any) => result.page_id).join(', ');
            const retrieved_contents = searchResults.map((result: any) => result.content).join('\n');
            setDocumentContext(retrieved_contents);
            worker.current?.postMessage({
              type: 'generate_text',
              data: {
                prompt: e.data.prompt,
                query: e.data.query,
                context: "Pages:" + retrieved_pages + "\n\n" + retrieved_contents,
              },
            });
            setInput('');
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
  }, [userInput]);

  const checkRules = async (query: string) => {
    const rules = await getRootRules(db.current);
    const engine = new RulesEngine();

    // Skip rules with empty condition arrays
    rules.map((rule: RuleNode) => {
      if (rule.conditions.length > 0) {
        engine.addRootRule(rule);
      }
    });
    try {
      return engine.evaluate({ query: query });
    } catch (error) {
      console.error('Error evaluating rules: ', error);
      return undefined;
    }
  }

  return (
    <div className="space-y-6 p-2 pb-16 md:block md:p-10">
      <div className="space-y-0.5 p-2">
        <h2 className="text-2xl font-bold tracking-tight">DocuGenie</h2>
        <p className="text-muted-foreground">
          Your personal assistant for document analysis.
        </p>
      </div>
      <Separator className="my-6" />
      <main className="w-full">
        <div className="flex-1 overflow-auto p-2 w-full md:p-6">
          <div className="max-w-3xl mx-auto grid gap-8">
            <div>
              <form onSubmit={handleSubmit} className="grid gap-2">
                <Textarea
                  placeholder="Enter your prompt here..."
                  className={`${isLoading ? 'bg-muted' : ''} text-foreground rounded-lg p-4 text-lg font-medium resize-none`}
                  rows={3}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setUserInput('')}>Clear</Button>
                  <Button type="submit" disabled={isLoading || !userInput.trim()}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}</Button>
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
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button data-testid="copy-button" variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(answerResult)}>
                          <Copy className="w-5 h-5" />
                          <span className="sr-only">Copy</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copy</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
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
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Download</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => navigator.share({ title: "DocuGenie", text: answerResult })}>
                          <Share className="w-5 h-5" />
                          <span className="sr-only">Share</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Share</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>


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
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(prompt.prompt)}>
                                  <Copy className="w-5 h-5" />
                                  <span className="sr-only">Copy</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Copy</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
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
