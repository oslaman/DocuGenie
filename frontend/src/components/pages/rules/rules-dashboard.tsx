import { RulesContext } from "@/context/context";
import RulesTree from "@/components/features/rule-tree/RulesTree";
import RulesTable from "@/components/features/rule-table/RulesTable";
import { useEffect, useRef, useState, useTransition } from "react";
import { Rules } from "@/utils/interfaces";
import { getDB } from '@/utils/db/db-helper';
import { getAllRuleNodes } from '@/utils/db/db-rules';

export function RulesDashboard() {
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
            }
        };

        if (!db.current && !initializing.current) {
            setup();
        }
    }, []);

    return (
        <div className="dashboard-container w-full flex-col gap-4">
            <RulesContext.Provider value={{ rules, setRules }}>
                <RulesTable />
                <RulesTree />
            </RulesContext.Provider>
        </div>
    );
} 