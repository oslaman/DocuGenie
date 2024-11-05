import React, { useState, useRef, useEffect } from 'react';
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress";
import { recursiveChunkingWithPages, TextWithPage } from '@/utils/chunking';
import { useLocation } from "react-router-dom";
import { Rules, WorkerMessageEvent } from '@/utils/interfaces';

import { getDB, initSchema, countRows, getDbData, clearDb, getDbSizeInBytes } from '@/utils/db/db-helper';
import { getAllRuleNodes } from '@/utils/db/db-rules';
import { seedDb, seedSingleDb } from '@/utils/db/db-documents';
import { formatBytes } from '@/utils/helpers';
import ChatWorker from '@/workers/worker.js?worker';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react"

import '@/App.css';

export default function DocumentForm() {
    const location = useLocation();
    const [progress, setProgress] = React.useState(0);
    const [dbRows, setDbRows] = useState<number>(0);
    const [rules, setRulesItems] = useState<Rules[]>([]);
    const [dbSize, setDbSize] = useState<string>("0");
    const setRules = (value: Rules[]) => {
        setRulesItems(value);
    }
    const initailizing = useRef<boolean>(false);

    const worker = useRef<Worker | null>(null);
    const db = useRef<any>(null);

    useEffect(() => {
        const setup = async () => {
            initailizing.current = true;
            db.current = await getDB();
            await initSchema(db.current);
            const count = await countRows(db.current, "embeddings");
            const size = await getDbSizeInBytes(db.current);
            // const size = 0;
            const allNodes = await getAllRuleNodes(db.current);
            console.log("All nodes: ", allNodes.map((node) => JSON.parse(node.rule.toJSON()).conditions));
            setRules([]);
            setRules(allNodes.map((node) => ({
                id: node.id,
                rule: node.rule,
                parent: node.parent !== null ? node.parent.toString() : ''
            }))); setDbRows(count);
            setDbSize(formatBytes(size));
            console.log(`Found ${count} rows`);
        };
        if (!db.current && !initailizing.current) {
            setup();
        }
    }, []);

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
                case "embedding_complete": {
                    setProgress(0);
                    const result = e.data.output;
                    console.log("Result: ", result)
                    await seedSingleDb(db.current, result as any);
                    const count = await countRows(db.current, "embeddings");
                    setDbRows(count);
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
                await seedDb(db.current, embeddings);
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

    async function handleMultipleEmbeddingsUpload(event: React.ChangeEvent<HTMLInputElement>) {
        event.preventDefault();
        console.log("Dati db: ", await getDbData(db.current));
        const files = Array.from(event.target.files || []);
        console.log(files)
        const totalFiles = files.length;
        setProgress(0);
        const fileElements: any[] = [];

        const t1 = performance.now();

        for (let index = 0; index < totalFiles; index++) {
            const file = files[index];
            if (file instanceof File) {
                await processFile(file, fileElements);
            }
        }

        await seedDb(db.current, fileElements);
        setProgress(100);
        console.log("Upload complete");
        const rows = await countRows(db.current, "embeddings");
        setDbRows(rows);

        const t2 = performance.now();
        console.log(`Time taken for uploading: ${((t2 - t1) / 1000).toFixed(2)} seconds`);
    }

    async function processFile(file: File, fileElements: any[]) {
        return new Promise<void>((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const content = e.target?.result as string;
                    const embedding = JSON.parse(content);
                    if (embedding && typeof embedding === 'object') {
                        fileElements.push(embedding);
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
        } catch (error) {
            console.error("Error clearing the database:", error);
        }
    };
    return (
        <>
            <form className='w-full space-y-6 md:w-2/3'>
            <div className='grid w-full items-center gap-4'>
                <div className="grid grid-cols-[1fr,auto] items-center gap-2">
                    <Label htmlFor="pages-upload">
                        Upload JSON with text and page number for each page.
                    </Label>
                    <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                 </TooltipTrigger>
                                <TooltipContent>
                                    <p>The chunking and embedding will be created automatically.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    <Input type="file" id="pages-upload" onChange={handlePagesUpload} />
                </div>
                <div className="grid grid-cols-[1fr,auto] items-center gap-2">
                    <Label htmlFor="file-upload">
                        Upload of JSON with chunks and page numbers.
                    </Label>
                    <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>The embedding will be created automatically.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    <Input type="file" id="file-upload" onChange={handleFileUpload} />
                </div>
                <div className="grid grid-cols-[1fr,auto] items-center gap-2">
                    <Label htmlFor="embeddings-upload">
                        Upload of JSON with chunks, page numbers and embeddings.
                    </Label>
                    <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>The embedding are already done and will not be created automatically.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    <Input type="file" id="embeddings-upload" multiple onChange={handleEmbeddingsUpload} />
                </div>
                <div className="grid grid-cols-[1fr,auto] items-center gap-2">
                    <Label htmlFor="embeddings-upload">
                        Upload of multiple JSONs with a chunk, page number and embeddings each.
                    </Label>
                    <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>The embedding are already done and will not be created automatically.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    <Input type="file" id="embeddings-upload" multiple onChange={handleMultipleEmbeddingsUpload} />
                </div>
                </div>
                <Progress value={progress} />
            </form>
            <Card
                className="max-w-xs h-fit w-full" x-chunk="charts-01-chunk-3"
            >
                <CardHeader className="p-4 pb-0">
                    <CardTitle>Database Info</CardTitle>
                    <CardDescription>
                        Database size: {dbSize}
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
        </>
    );
}