import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
  } from 'reactflow';
  import 'reactflow/dist/style.css';
import { useRulesContext } from '@/components/context';
import { DataTable } from '@/components/rules/data-table';
import { RuleItems, columns } from "@/components/rules/columns"
import { RuleNode } from '@/utils/rete-network';
import { Rules } from '@/pages/Settings';

const initialNodes: any[] = [
    {
        id: '1',
        type: 'input',
        data: { label: 'Input Node' },
        position: { x: 0, y: 0 }
    },
    {
        id: '2',
        type: 'output',
        data: { label: 'Output Node' },
        position: { x: 250, y: 0 }
    }
];

const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

export async function getRulesData(rules: Rules[]): Promise<RuleItems[]> {
    console.log('Table rules', rules);
    const rulesData = rules.map((rule) => ({
        id: rule.id,
        name: rule.rule.name,
        salience: rule.rule.salience,
        children: rule.rule.children.length
    }));
    return rulesData;
}

const RulesTree: React.FC = () => {
    const {rules, setRules} = useRulesContext();
    const [nodes, setNodes] = useState<any[]>(initialNodes);
    const [edges, setEdges] = useState<any[]>(initialEdges);
    const [tableData, setTableData] = useState<RuleItems[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            const data = await getRulesData(rules);
            setTableData(data);
        };
        fetchData();
    }, [rules]);    

    const onNodesChange = useCallback((changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
    const onEdgesChange = useCallback((changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

    const onConnect = useCallback((params: any) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    return (
        <div className="container mx-auto">
            <DataTable columns={columns} data={tableData} />
            {/* <ReactFlow 
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
            >
                <MiniMap />
                <Controls />
                <Background />
            </ReactFlow> */}
        </div>
    );
};

export default RulesTree;
