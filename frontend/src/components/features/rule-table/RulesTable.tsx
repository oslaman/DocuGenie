import React, { useEffect, useState, useRef } from 'react';
import { DataTable } from '@/components/features/rule-table/data-table';
import { columns } from "@/components/features/rule-table/columns";
import { getDB } from '@/utils/db/db-helper';
import { removeRuleNode } from '@/utils/db/db-rules';
import { useRulesContext } from '@/context/context';
import { Rules } from '@/utils/interfaces';
import { RuleItems } from '@/utils/types';



const RulesTable: React.FC = () => {
    const { rules, setRules } = useRulesContext();
    const [tableData, setTableData] = useState<RuleItems[]>([]);
    const ref = useRef(null);
    const db = useRef<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            db.current = await getDB();
            const data = await getRulesData(rules);
            console.log(data);
            setTableData(data);
        };

        fetchData();
    }, [rules]);

    async function getRulesData(rules: Rules[]): Promise<RuleItems[]> {
            console.log('Table rules', rules);
            const rulesData = rules.map((rule) => ({
                id: rule.id,
                name: rule.rule.name,
                salience: rule.rule.salience,
                children: rule.rule.children.length,
                parent: rule.parent,
                prompt: rule.rule.prompt,
                page: rule.rule.page,
            }));
            return rulesData;
        }

    return (
        <React.Fragment>
            <DataTable columns={columns} data={tableData} />
        </React.Fragment>
    );
}

export default RulesTable;