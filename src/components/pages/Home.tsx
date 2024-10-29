import { useState, useRef, useEffect, useCallback } from 'react';
import { InputDialogue } from "@/components/InputDialogue";
import { WorkerMessageEvent } from '@/utils/interfaces';
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Send, Loader2, Bot, User } from 'lucide-react'

import { getDB, initSchema, countRows } from '@/utils/db/db-helper';
import { search } from '@/utils/db/db-documents';
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
      await worker.current.postMessage({ type: "search", data: { query: input } });
    }

    // // Mock response
    // const assistantMessage: Message = {
    //   role: 'assistant',
    //   content: `Here's a simulated response to: "${input}"`
    // }
    // setMessages(prevMessages => [...prevMessages, assistantMessage])
    // setIsLoading(false)
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
        case "text_generation_complete": {
          //   accumulatedContent += e.data.output?.content || ''; // Accumulate the content
          // if (e.data.isFinal) { // Check if the stream is complete
          //   const assistantMessage: Message = {
          //     role: 'assistant',
          //     content: accumulatedContent // Use the accumulated content
          //   }
          //   setMessages(prevMessages => [...prevMessages, assistantMessage])
          //   setIsLoading(false)
          //   setAnswerResult(accumulatedContent);
          //   accumulatedContent = ''; // Reset the accumulator
          // }
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
