import { RulesContext } from "@/context/context";
import RulesTree from "@/components/features/rule-tree/RulesTree";
import { useState } from "react";
import { RuleForm } from "@/components/features/rule-form/RuleForm";
import { useEffect, useRef } from "react";
import { Rules } from "@/utils/interfaces";

import { getDB, initSchema, countRows } from '@/utils/db/db-helper';
import { getAllRuleNodes, getRuleById } from '@/utils/db/db-rules';
import { useTransition } from "react";

export default function RulesForm() {
    const [rules, setRulesItems] = useState<Rules[]>([]);
    const [isPending, startTransition] = useTransition();
    const setRules = (value: Rules[]) => {
        setRulesItems(value);
    }

    const initializing = useRef(false);
    const db = useRef<any>(null);

    useEffect(() => {
        const setup = async () => {
            try {
                initializing.current = true;
                db.current = await getDB();
                let allNodes = await getAllRuleNodes(db.current);

                if (!allNodes || allNodes.length === 0) {
                    console.warn("No nodes found");
                } else {
                    console.log("Nodes: ", allNodes.map((node) => JSON.parse(node.rule.toJSON()).conditions));
                }

                const formattedNodes = allNodes.map((node) => ({
                    id: node.id,
                    rule: node.rule,
                    parent: node.parent !== null ? node.parent.toString() : ''
                }));

                startTransition(() => {
                    setRules(formattedNodes);
                });
            } catch (error) {
                console.error("Error setting up rules:", error);
            } finally {
                initializing.current = false;
                console.log("Rules setup: ", rules);
            }
        };

        if (!db.current && !initializing.current) {
            setup();
        }
    }, []);

    return (
        <div className="dashboard-container w-full flex-col gap-4">
            <RulesContext.Provider value={{ rules, setRules }}>
                <RuleForm />
                <RulesTree />
            </RulesContext.Provider>
        </div>
    );
}
