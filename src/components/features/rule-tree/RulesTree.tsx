import React, { useState, useEffect, useCallback, type ChangeEventHandler, useRef } from 'react';
import {
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    ConnectionLineType,
    getIncomers,
    getOutgoers,
    getConnectedEdges,
    Panel,
    type Node,
    type Edge,
    type OnConnect,
    type OnEdgesChange,
    useReactFlow
} from 'reactflow';
import {ReactFlow} from 'reactflow';
import 'reactflow/dist/style.css';
import { useRulesContext } from '@/context/context';
import { DataTable } from '@/components/features/rule-table/data-table';
import { RuleItems, columns } from "@/components/features/rule-table/columns"
import { Rules } from '@/utils/interfaces';
import dagre from '@dagrejs/dagre';
import { Button } from '@/components/ui/button';

import { getDB } from '@/utils/db/db-helper';
import { removeRuleNode, removeParent } from '@/utils/db/db-rules';

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

const initialEdges = [{ id: '1->2', source: '1', target: '2', type: edgeType, animated: true }];


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

const RulesTree: React.FC = () => {
    const { rules, setRules } = useRulesContext();
    const [tableData, setTableData] = useState<RuleItems[]>([]);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [menu, setMenu] = useState<any>(null);
    const ref = useRef(null);
    const db = useRef<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            db.current = await getDB();
            const data = await getRulesData(rules);
            setTableData(data);

            const newNodes: any[] = [];
            const newEdges: any[] = [];

            rules.forEach((rule) => {
                newNodes.push({
                    id: `${rule.id}`,
                    type: rule.parent === '' ? 'input' : rule.rule.children.length > 0 ? null : 'output',
                    data: {
                        label: rule.rule.name,
                        rule: rule
                    },
                    position: position,
                });
            });

            rules.forEach((rule) => {
                if (rule.parent && rule.parent !== '-') {
                    newEdges.push({
                        id: `${rule.parent}->${rule.id}`,
                        source: `${rule.parent}`,
                        target: `${rule.id}`,
                        type: edgeType,
                        animated: true
                    });
                }
            });

            console.log("Nodes:", newNodes);
            console.log("Edges:", newEdges);

            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges, 'TB');
            setNodes([...layoutedNodes] as any);
            setEdges([...layoutedEdges] as any);
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
            page: rule.rule.actionValue,
        }));
        return rulesData;
    }

    const onLayout = useCallback(
        (direction: string) => {
            const { nodes: layoutedNodes, edges: layoutedEdges } =
                getLayoutedElements(nodes, edges, direction);

            setNodes([...layoutedNodes] as any);
            setEdges([...layoutedEdges] as any);
        },
        [nodes, edges],
    );

    const onNodeDoubleClick = (event: any, node: any) => {
        console.log('Node double clicked', node);
        window.location.href = `/settings/rules/${node.data.rule.id}`;
    };

    const onEdgesDelete = useCallback(
        (deleted: any[]) => {
            console.log("Edges deleted", deleted);
            setEdges((eds) => applyEdgeChanges(deleted, eds));
            deleted.forEach((edge) => {
                console.log("Edge target", edge.target);
                removeParent(db.current, edge.target);
            });
        },
        [setEdges],
    );

    const onNodesDelete = useCallback(
        (deleted: any[]) => {
            console.log("Nodes deleted", deleted);
            setEdges(
                deleted.reduce((acc: Edge[], node: Node) => {
                    const incomers = getIncomers(node, nodes, edges);
                    const outgoers = getOutgoers(node, nodes, edges);
                    const connectedEdges = getConnectedEdges([node], edges);

                    const remainingEdges = acc.filter(
                        (edge: any) => !connectedEdges.includes(edge as never),
                    );

                    const createdEdges = incomers.flatMap(({ id: source }) =>
                        outgoers.map(({ id: target }) => ({
                            id: `${source}->${target}`,
                            source,
                            target,
                            type: edgeType,
                            animated: true
                        })),
                    );

                    console.log("Deleted nodes", deleted);
                    console.log("Node to be deleted", deleted[0]);

                    removeRuleNode(db.current, deleted[0].id);
                    setTableData((tableData) => tableData.filter((t) => t.id !== deleted[0].id));

                    // remove node from rules
                    const updatedRules = rules.filter((rule: Rules) => rule.id !== deleted[0].id);
                    setRules(updatedRules);

                    let parent = deleted[0].data.rule.parent;
                    parent = parent === "-" ? undefined : parent;
                    return [...remainingEdges, ...createdEdges];
                }, edges),
            );
        },
        [nodes, edges],
    );

    return (
        <React.Fragment>
            <DataTable columns={columns} data={tableData} />
            <div className="container mx-auto w-full h-96">
                <ReactFlow
                    ref={ref}
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesDelete={onEdgesDelete}
                    connectionLineType={ConnectionLineType.SmoothStep}
                    zoomOnDoubleClick={true}
                    zoomOnScroll={true}
                    zoomOnPinch={true}
                    onNodeDoubleClick={onNodeDoubleClick}
                    onNodesDelete={onNodesDelete}
                    fitView
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
                    <Background />
                </ReactFlow>
            </div>
        </React.Fragment>
    );
};

export default RulesTree;
