import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Send, Loader2, Bot, User } from 'lucide-react'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type ChatInterfaceProps = {
  handleSubmit: any
  messages: Message[]
  isLoading: boolean
  input: string
  setInput: any
}

export default function ChatInterface({handleSubmit, messages, isLoading, input, setInput}: ChatInterfaceProps) {

  return (
    <Card className="w-full max-w-2xl mx-auto h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle>RAG Chat Interface</CardTitle>
        <CardDescription>Ask questions and get AI-generated responses</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <ScrollArea className="h-full pr-4">
          {messages.map((message, index) => (
            <div key={index} className={`flex items-start mb-4 ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
              <div className={`flex ${message.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'} items-start max-w-[80%]`}>
                <Avatar className="w-8 h-8 mt-0.5 mx-2">
                  <AvatarFallback>{message.role === 'assistant' ? 'AI' : 'You'}</AvatarFallback>
                  <AvatarImage src={message.role === 'assistant' ? '/placeholder.svg' : '/placeholder-user.jpg'} />
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
            className="flex-grow"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}

// type ChatInterfaceProps = {
//   messages: Message[]
//   index: number
//   handleSubmit: any
//   input: string
//   e: any
//   setInput: any
//   isLoading: boolean
// }

// export function ChatInterface({messages, index, handleSubmit, input, e, setInput, isLoading}: ChatInterfaceProps) {
//     return (<Card className="w-full max-w-2xl mx-auto h-[600px] flex flex-col">
//         <CardHeader>
//           <CardTitle>RAG Chat Interface</CardTitle>
//           <CardDescription>Ask questions and get AI-generated responses</CardDescription>
//         </CardHeader>
//         <CardContent className="flex-grow overflow-hidden">
//           <ScrollArea className="h-full pr-4">
//             {messages.map((message, index) => <div key={index} className={`flex items-start mb-4 ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
//                 <div className={`flex ${message.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'} items-start max-w-[80%]`}>
//                   <Avatar className="w-8 h-8 mt-0.5 mx-2">
//                     <AvatarFallback>{message.role === 'assistant' ? 'AI' : 'You'}</AvatarFallback>
//                     <AvatarImage src={message.role === 'assistant' ? '/placeholder.svg' : '/placeholder-user.jpg'} />
//                   </Avatar>
//                   <div className={`rounded-lg p-3 ${message.role === 'assistant' ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground'}`}>
//                     <p className="text-sm">{message.content}</p>
//                   </div>
//                 </div>
//               </div>)}
//           </ScrollArea>
//         </CardContent>
//         <CardFooter>
//           <form onSubmit={handleSubmit} className="flex w-full items-center space-x-2">
//             <Input type="text" placeholder="Type your message..." value={input} onChange={e => setInput(e.target.value)} className="flex-grow" />
//             <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
//               {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
//               <span className="sr-only">Send message</span>
//             </Button>
//           </form>
//         </CardFooter>
//       </Card>);
//   }
