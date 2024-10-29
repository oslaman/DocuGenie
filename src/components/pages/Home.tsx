import { useState, useRef, useEffect, useCallback } from 'react';
import { WorkerMessageEvent } from '@/utils/interfaces';
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar } from "@/components/ui/avatar"
import { Send, Loader2, Bot, User, Copy, Download, Share } from 'lucide-react'
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"

import { getDB, initSchema, countRows } from '@/utils/db/db-helper';
import { search, searchWithPage } from '@/utils/db/db-documents';
import { getRootRules } from '@/utils/db/db-rules';
import { RuleNode, RulesEngine } from '@/utils/rete-network';

import '@/App.css';

import ChatWorker from '@/workers/worker.js?worker';

type Message = {
  role: 'user' | 'assistant'
  content?: string
}

const Home: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [documentContext, setDocumentContext] = useState<string>('');
  const [answerResult, setAnswerResult] = useState<any>('');
  const initailizing = useRef<boolean>(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const worker = useRef<Worker | null>(null);
  const db = useRef<any>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!input.trim()) return

    console.log("Input: ", input);

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prevMessages => [...prevMessages, userMessage])
    setIsLoading(true)

    if (worker.current) {
      setAnswerResult(null);
      setDocumentContext('');
      const pages = await checkRules(input);
      if (pages) {
        await worker.current.postMessage({ type: "search", data: { query: input, pages: pages } });
      } else {
        await worker.current.postMessage({ type: "search", data: { query: input } });
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
            const currentInput = input
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
        case "found_pages":
          {
            if (e.data.pages) {
              const searchResults = await searchWithPage(db.current, e.data.query, e.data.pages);
              worker.current?.postMessage({
                type: 'generate_text',
                data: {
                  query: e.data.query,
                  context: "Pages:" + searchResults.join(', '),
                },
              });
            }
            break;
          }
        case "text_generation_complete": {
          const assistantMessage: Message = {
            role: 'assistant',
            content: e.data.output
          }
          setMessages(prevMessages => [...prevMessages, assistantMessage])
          setIsLoading(false)
          //setAnswerResult(accumulatedContent);
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

  const classify = useCallback((text: string) => {
    if (worker.current) {
      setAnswerResult(null);
      setDocumentContext('');
      worker.current.postMessage({ type: "search", data: { query: text } });
    }
  }, []);

  return (
    <div className="app-container hidden space-y-6 p-10 pb-16 md:block">
      <div className="space-y-0.5">
        <h2 className="text-2xl font-bold tracking-tight">DocuGenie</h2>
        <p className="text-muted-foreground">
          Your personal assistant for document analysis.
        </p>
      </div>
      <Separator className="my-6" />
      <main className="app-main">
        <Card className="w-full max-w-2xl mx-auto h-[600px] flex flex-col">
          <CardHeader>
            <CardTitle>RAG Chat Interface</CardTitle>
            <CardDescription>Ask your questions here</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow overflow-hidden">
            <ScrollArea className="h-full pr-4">
              {messages.map((message, index) => (
                <div key={index} className={`flex items-start mb-4 ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`flex ${message.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'} items-start max-w-[80%]`}>
                    <Avatar className="w-8 h-8 mt-0.5 mx-2">
                      {
                        message.role === 'assistant' ? <Bot /> : <User />
                      }
                    </Avatar>
                    <div className={`rounded-lg p-3 ${message.role === 'assistant' ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`}>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </ScrollArea>
          </CardContent>
          <CardFooter>
            <form onSubmit={handleSubmit} className="flex w-full items-center space-x-2">
              <Input
                type="text"
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onSubmit={handleSubmit}
                className={`flex-grow ${isLoading ? 'bg-muted' : ''}`}
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="sr-only">Send message</span>
              </Button>
            </form>
          </CardFooter>
        </Card>
        <div className="flex-1 overflow-auto p-6">
                <div className="max-w-3xl mx-auto grid gap-8">
                    <div className="grid gap-2">
                        <Textarea
                            placeholder="Enter your prompt here..."
                            className="bg-muted text-foreground rounded-lg p-4 text-lg font-medium resize-none"
                            rows={3}
                        />
                        <div className="flex justify-end gap-2">
                            <Button variant="outline">Clear</Button>
                            <Button>Submit</Button>
                        </div>
                    </div>
                    <div className="grid gap-4">
                        <div className="bg-muted rounded-lg p-4">
                            <h2 className="text-lg font-medium mb-2">Model Output</h2>
                            <div className="prose text-foreground">
                                <p>The large language model has generated the following response based on your prompt:</p>
                                <p>
                                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ut risus in augue luctus venenatis. Sed
                                    quis lacus non lectus bibendum finibus. Nullam euismod, nisl eget ultricies tincidunt, nisi nisl
                                    aliquam nisl, eget aliquam nisl nisl eget nisl.
                                </p>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <Button variant="ghost" size="icon">
                                    <Copy className="w-5 h-5" />
                                    <span className="sr-only">Copy</span>
                                </Button>
                                <Button variant="ghost" size="icon">
                                    <Download className="w-5 h-5" />
                                    <span className="sr-only">Download</span>
                                </Button>
                                <Button variant="ghost" size="icon">
                                    <Share className="w-5 h-5" />
                                    <span className="sr-only">Share</span>
                                </Button>
                            </div>
                        </div>
                        <div className="bg-muted rounded-lg p-4">
                            <h2 className="text-lg font-medium mb-2">Parameters</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-1">
                                    <Label htmlFor="temperature">Temperature</Label>
                                    <Slider id="temperature" defaultValue={[0.7]} min={0} max={1} step={0.01} />
                                </div>
                                <div className="grid gap-1">
                                    <Label htmlFor="max-tokens">Max Tokens</Label>
                                    <Input id="max-tokens" type="number" defaultValue={256} min={1} max={2048} />
                                </div>
                                <div className="grid gap-1">
                                    <Label htmlFor="top-p">Top P</Label>
                                    <Slider id="top-p" defaultValue={[0.9]} min={0} max={1} step={0.01} />
                                </div>
                                <div className="grid gap-1">
                                    <Label htmlFor="top-k">Top K</Label>
                                    <Input id="top-k" type="number" defaultValue={50} min={1} max={200} />
                                </div>
                            </div>
                        </div>
                        <div className="bg-muted rounded-lg p-4">
                            <h2 className="text-lg font-medium mb-2">History</h2>
                            <div className="grid gap-2">
                                <div className="flex items-center gap-2 p-2 rounded-md hover:bg-background">
                                    <div className="text-sm font-medium">Prompt 1</div>
                                    <div className="text-sm text-muted-foreground">2 min ago</div>
                                    <div className="flex-1" />
                                    <Button variant="ghost" size="icon">
                                        <Copy className="w-5 h-5" />
                                        <span className="sr-only">Copy</span>
                                    </Button>
                                </div>
                                <div className="flex items-center gap-2 p-2 rounded-md hover:bg-background">
                                    <div className="text-sm font-medium">Prompt 2</div>
                                    <div className="text-sm text-muted-foreground">10 min ago</div>
                                    <div className="flex-1" />
                                    <Button variant="ghost" size="icon">
                                        <Copy className="w-5 h-5" />
                                        <span className="sr-only">Copy</span>
                                    </Button>
                                </div>
                                <div className="flex items-center gap-2 p-2 rounded-md hover:bg-background">
                                    <div className="text-sm font-medium">Prompt 3</div>
                                    <div className="text-sm text-muted-foreground">30 min ago</div>
                                    <div className="flex-1" />
                                    <Button variant="ghost" size="icon">
                                        <Copy className="w-5 h-5" />
                                        <span className="sr-only">Copy</span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                </div>
            </div>
        </div>
        {/* <section className="search-section">
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
        </section> */}

      </main>
    </div>
  );
};

export default Home;
