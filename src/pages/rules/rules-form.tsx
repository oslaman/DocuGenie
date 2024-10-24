import { RulesContext } from "@/components/context";
import RulesTree, { getRulesData } from "@/components/RulesTree";
import { useState } from "react";
import { RuleNode } from "@/utils/rete-network";
import {RuleForm} from "@/components/RuleForm";
import { getDB, initSchema, countRows, getAllRuleNodes, getRuleById} from "@/utils/db";
import { useEffect, useRef } from "react";

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

interface RulesFormProps {
    id?: string;
}

export default function RulesForm({ id }: RulesFormProps) {
    const [rules, setRulesItems] = useState<Rules[]>([]);
    const setRules = (value: Rules[]) => {
        setRulesItems(value);
    }

    const initailizing = useRef(false);
    const db = useRef<any>(null);

    useEffect(() => {
        const setup = async () => {
            initailizing.current = true;
            db.current = await getDB();
            await initSchema(db.current);
            const count = await countRows(db.current, "embeddings");
            if (id) {
                console.log("ID: ", id);
                const allNodes = await getRuleById(db.current, id);
                console.log("Node: ", allNodes.map((node) => JSON.parse(node.rule.toJSON()).conditions));
                setRules([]);
                setRules(allNodes.map((node) => ({ id: node.id, rule: node.rule, parent: node.parent || '-' })));
            } else {
                const allNodes = await getAllRuleNodes(db.current);
                console.log("All nodes: ", allNodes.map((node) => JSON.parse(node.rule.toJSON()).conditions));
                setRules([]);
                setRules(allNodes.map((node) => ({ id: node.id, rule: node.rule, parent: node.parent || '-' })));
            }
            console.log(`Found ${count} rows`);
        };
        if (!db.current && !initailizing.current) {
            setup();
        }
    }, []);

    return (
        <>
            <div className="dashboard-container w-full flex-col gap-4">
                <RulesContext.Provider value={{ rules, setRules }}>
                    <RuleForm rule={rules[0]}/>
                    <RulesTree />
                </RulesContext.Provider>
            </div>
        </>
    );
}
