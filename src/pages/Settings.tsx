import React, { useState, useRef, useEffect } from 'react';
import { getDB, initSchema, countRows, seedDb, seedSingleDb, clearDb, getDbData, getAllRuleNodes } from '../utils/db';
import { recursiveChunkingWithPages, TextWithPage } from '../utils/chunking';
import RulesTree from '@/components/RulesTree';
import { RuleNode } from '@/utils/rete-network';
import { RuleForm } from '@/components/RuleForm';
import { RulesContext } from '@/components/context';
import { useLocation } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

import '../App.css';
import { SidebarNav } from '@/components/sidebar-nav';
import DocumentsPage from './documents/page';
import RulesPage from './rules/page';
import { useParams } from 'react-router-dom';

interface WorkerMessageEvent extends MessageEvent {
    data: {
        status: string;
        embedding?: any;
        output?: { content: string };
    };
}

export interface Rules {
    id: string;
    parent: string;
    rule: RuleNode;
}

const sidebarNavItems = [
    {
        title: "Documents",
        href: "/settings/documents",
    },
    {
        title: "Rules",
        href: "/settings/rules",
    },
];

const Settings = () => {
    const location = useLocation();
    const [progress, setProgress] = React.useState(0);
    const [dbRows, setDbRows] = useState<number>(0);
    const [rules, setRulesItems] = useState<Rules[]>([]);
    const { ruleId } = useParams();
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
            console.log("All nodes: ", allNodes.map((node) => JSON.parse(node.rule.toJSON()).conditions));
            setRules([]);
            setRules(allNodes.map((node) => ({ id: node.id, rule: node.rule, parent: node.parent || '-' })));
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


    return (
        <div className="hidden space-y-6 p-10 pb-16 md:block">
            <div className="space-y-0.5">
                <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground">
                    Manage your documents and rules preferences.
                </p>
            </div>
            <Separator className="my-6" />
            <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
                <aside className="-mx-4 lg:w-1/5 lg:sticky lg:top-0">
                    <SidebarNav items={sidebarNavItems} />
                </aside>
                <main className="flex-1 lg:max-w-2xl">
                    {location.pathname === "/settings/documents" && (
                        <DocumentsPage />
                    )}
                    {location.pathname === "/settings/rules" && (
                        <RulesPage />
                    )}
                    {location.pathname === `/settings/rules/${ruleId}` && (
                        <RulesPage id={ruleId} />
                    )}
                </main>
            </div>
        </div>
    );
};

export default Settings;
