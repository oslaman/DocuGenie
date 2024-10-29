/**
 * v0 by Vercel.
 * @see https://v0.dev/t/y5MGh5HLX4O
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"

export default function Component() {
    return (
        <div className="flex flex-col h-screen bg-background text-foreground">
            <header className="sticky top-0 z-10 bg-background border-b border-muted px-6 py-4 flex items-center gap-4">
                <h1 className="text-2xl font-bold">LLM Playground</h1>
                <div className="flex-1" />
                <Button variant="ghost" size="icon">
                    <SettingsIcon className="w-5 h-5" />
                    <span className="sr-only">Settings</span>
                </Button>
            </header>
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
                                    <CopyIcon className="w-5 h-5" />
                                    <span className="sr-only">Copy</span>
                                </Button>
                                <Button variant="ghost" size="icon">
                                    <DownloadIcon className="w-5 h-5" />
                                    <span className="sr-only">Download</span>
                                </Button>
                                <Button variant="ghost" size="icon">
                                    <ShareIcon className="w-5 h-5" />
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
                                        <CopyIcon className="w-5 h-5" />
                                        <span className="sr-only">Copy</span>
                                    </Button>
                                </div>
                                <div className="flex items-center gap-2 p-2 rounded-md hover:bg-background">
                                    <div className="text-sm font-medium">Prompt 2</div>
                                    <div className="text-sm text-muted-foreground">10 min ago</div>
                                    <div className="flex-1" />
                                    <Button variant="ghost" size="icon">
                                        <CopyIcon className="w-5 h-5" />
                                        <span className="sr-only">Copy</span>
                                    </Button>
                                </div>
                                <div className="flex items-center gap-2 p-2 rounded-md hover:bg-background">
                                    <div className="text-sm font-medium">Prompt 3</div>
                                    <div className="text-sm text-muted-foreground">30 min ago</div>
                                    <div className="flex-1" />
                                    <Button variant="ghost" size="icon">
                                        <CopyIcon className="w-5 h-5" />
                                        <span className="sr-only">Copy</span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="bg-muted rounded-lg p-4">
                            <h2 className="text-lg font-medium mb-2">Code Snippet</h2>
                            <div className="prose text-foreground">
                                <pre>
                                    <code>{`
function generateResponse(prompt) {
  const response = await fetch('/api/llm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt })
  });
  const data = await response.json();
  return data.result;
}
                    `}</code>
                                </pre>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <Button variant="ghost" size="icon">
                                    <CopyIcon className="w-5 h-5" />
                                    <span className="sr-only">Copy</span>
                                </Button>
                                <Button variant="ghost" size="icon">
                                    <DownloadIcon className="w-5 h-5" />
                                    <span className="sr-only">Download</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function CopyIcon(props) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
    )
}


function DownloadIcon(props) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" x2="12" y1="15" y2="3" />
        </svg>
    )
}


function SettingsIcon(props) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    )
}


function ShareIcon(props) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" x2="12" y1="2" y2="15" />
        </svg>
    )
}