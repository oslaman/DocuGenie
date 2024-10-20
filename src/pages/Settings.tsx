import React, { useState, useRef, useEffect } from 'react';
import { getDB, initSchema, countRows, seedDb, seedSingleDb, clearDb, getDbData, insertRootRuleNode, getAllRuleNodes } from '../utils/db';
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
import { recursiveChunkingWithPages, TextWithPage } from '../utils/chunking';
import RulesTree from '@/components/RulesTree';
import { RuleNode } from '@/utils/rete-network';
import { RuleForm } from '@/components/RuleForm';
import { RulesContext } from '@/components/context';

import '../App.css';

interface WorkerMessageEvent extends MessageEvent {
    data: {
        status: string;
        embedding?: any;
        output?: { content: string };
    };
}

export interface Rules {
    id: string;
    rule: RuleNode;
}

const Settings = () => {
    const [progress, setProgress] = React.useState(0);
    const [dbRows, setDbRows] = useState<number>(0);
    const [rules, setRulesItems] = useState<Rules[]>([]);
    const setRules = (value: Rules[]) => {
        setRulesItems(value);
    }
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
            const allNodes = await getAllRuleNodes(db.current);
            setRules([]);
            setRules(allNodes.map((node) => ({ id: node.id, rule: node.rule })));
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
                // for (let i = 0; i < embeddings.length; i++) {
                //   const embedding = embeddings[i];
                //   await seedDb(db.current, [embedding]);
                //   setProgress((i + 1) / elements * 100);
                // }
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
        <div className="app-container">
            <main className="app-main">
                <h1>Settings</h1>
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
                <section className="dashboard-container w-full flex-col gap-4">
                    <RulesContext.Provider value={{rules, setRules}}>
                        <RuleForm />
                        <RulesTree />
                    </RulesContext.Provider>
                </section>
            </main>
        </div>
    );
};

export default Settings;
