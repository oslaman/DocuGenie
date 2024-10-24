import React, { useState, useEffect, useCallback, type ChangeEventHandler } from 'react';
import ReactFlow, {
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    ConnectionLineType,
    Panel,
    type Node,
    type Edge,
    type OnConnect,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useRulesContext } from '@/components/context';
import { DataTable } from '@/components/rules/data-table';
import { RuleItems, columns } from "@/components/rules/columns"
import { Rules } from '@/pages/Settings';
import dagre from '@dagrejs/dagre';
import { Button } from '@/components/ui/button';

const position = { x: 0, y: 0 };
const edgeType = 'smoothstep';
const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

const nodeWidth = 172;
const nodeHeight = 36;

const initialNodes: any[] = [
    {
        id: '1',
        type: 'input',
        data: { label: 'Input Node' },
        position: position
    },
    {
        id: '2',
        data: { label: 'Output Node' },
        position: position
    }
];

const initialEdges = [{ id: 'e1-2', source: '1', target: '2', type: edgeType, animated: true }];


const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
    const isHorizontal = direction === 'LR';
    dagreGraph.setGraph({ rankdir: direction });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const newNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        const newNode = {
            ...node,
            targetPosition: isHorizontal ? 'left' : 'top',
            sourcePosition: isHorizontal ? 'right' : 'bottom',
            position: {
                x: nodeWithPosition.x - nodeWidth / 2,
                y: nodeWithPosition.y - nodeHeight / 2,
            },
        };

        return newNode;
    });

    return { nodes: newNodes, edges };
};

const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
    initialNodes,
    initialEdges,
);


export async function getRulesData(rules: Rules[]): Promise<RuleItems[]> {
    console.log('Table rules', rules);
    const rulesData = rules.map((rule) => ({
        id: rule.id,
        name: rule.rule.name,
        salience: rule.rule.salience,
        children: rule.rule.children.length,
        parent: rule.parent,
        page: rule.rule.actionValue,
    }));
    return rulesData;
}

const RulesTree: React.FC = () => {
    const { rules, setRules } = useRulesContext();
    const [tableData, setTableData] = useState<RuleItems[]>([]);

    const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

    const onConnect = useCallback(
        (params: any) =>
            setEdges((eds) =>
                addEdge(
                    { ...params, type: ConnectionLineType.SmoothStep, animated: true },
                    eds,
                ),
            ),
        [],
    );

    const onLayout = useCallback(
        (direction: string) => {
            const { nodes: layoutedNodes, edges: layoutedEdges } =
                getLayoutedElements(nodes, edges, direction);

            setNodes([...layoutedNodes]);
            setEdges([...layoutedEdges]);
        },
        [nodes, edges],
    );

    useEffect(() => {
        let newNodes: any[] = [];
        let newEdges: any[] = [];

        const fetchData = async () => {
            const data = await getRulesData(rules);
            setTableData(data);

            rules.forEach((rule) => {
                newNodes.push({
                    id: rule.id,
                    type: rule.id == '1' ? 'input' : rule.rule.children.length > 0 ? null : 'output',
                    data: { label: rule.rule.name },
                    position: position
                });

                if (rule.parent) {
                    newEdges.push({
                        id: `${rule.parent}-${rule.id}`,
                        source: rule.parent == '-' ? 1 : rule.parent,
                        target: rule.id,
                        type: edgeType,
                        animated: true
                    });
                }

                console.log(newNodes, newEdges)
            });

            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges, 'LR');
            setNodes([...layoutedNodes]);
            setEdges([...layoutedEdges]);
        };

        fetchData();
    }, [rules]);

    const onConnectEnd = (params: any) => {
        console.log('Connect end', params);
    };

    return (
        <React.Fragment>
            <DataTable columns={columns} data={tableData} />
            <div className="container mx-auto w-full h-96">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onConnectEnd={onConnectEnd}
                    connectionLineType={ConnectionLineType.SmoothStep}
                    fitView
                    zoomOnDoubleClick={true}
                    zoomOnScroll={true}
                    zoomOnPinch={true}
                >
                    <Panel position="top-right">
                        <div className="flex gap-2 ">
                            <Button onClick={() => onLayout('TB')}>Vertical layout</Button>
                            <Button onClick={() => onLayout('LR')}>Horizontal layout</Button>
                        </div>
                    </Panel>
                    <Controls />
                    <MiniMap
                        nodeColor={node => {
                            return node.type === 'input' ? 'red' : node.type === 'output' ? 'green' : 'grey';
                        }}
                    />
                </ReactFlow>
            </div>
        </React.Fragment>
    );
};

export default RulesTree;