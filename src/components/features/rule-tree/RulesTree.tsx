import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    getIncomers,
    getOutgoers,
    getConnectedEdges,
    Panel,
    type Node,
    type Edge,
} from 'reactflow';
import {ReactFlow} from 'reactflow';
import 'reactflow/dist/style.css';
import { useRulesContext } from '@/context/context';
import { DataTable } from '@/components/features/rule-table/data-table';
import { RuleItems, columns } from "@/components/features/rule-table/columns"
import { Rules } from '@/utils/interfaces';
import dagre from '@dagrejs/dagre';
import { Button } from '@/components/ui/button';
import { toast } from "sonner";

import { getDB } from '@/utils/db/db-helper';
import { removeRuleNode } from '@/utils/db/db-rules';

const position = { x: 0, y: 0 };
const edgeType = 'smoothstep';
const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

const nodeWidth = 172;
const nodeHeight = 36;

/**
 * Fetches the layouted elements for the rules tree for {@link RulesTree | `RulesTree`}.
 */
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

/**
 * Renders the rules tree.
 * @category Component
 */
const RulesTree: React.FC = () => {
    const { rules, setRules } = useRulesContext();
    const [tableData, setTableData] = useState<RuleItems[]>([]);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const ref = useRef(null);
    const db = useRef<any>(null);
    const treeOptions =  { hideAttribution: true };

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
                    type: rule.parent === '' || !rule.parent ? 'input' : rule.rule.children.length > 0 ? null : 'output',
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
            prompt: rule.rule.prompt,
            page: rule.rule.page,
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

    const onNodesDelete = useCallback(
        (deleted: any[]) => {
            console.log("Nodes deleted", deleted);
            setEdges(
                deleted.reduce(async (acc: Edge[], node: Node) => {
                    const incomers = getIncomers(node, nodes, edges);
                    const outgoers = getOutgoers(node, nodes, edges);
                    const connectedEdges = getConnectedEdges([node], edges);

                    const remainingEdges = acc.filter(
                        (edge: any) => !connectedEdges.includes(edge),
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

                    try {
                        await removeRuleNode(db.current, deleted[0].data.rule.id, deleted[0].data.rule.parent.toString());
                        setTableData((tableData) => tableData.filter((t) => t.id !== deleted[0].id));
                        toast.success(`Rule "${deleted[0].data.rule.id}" deleted.`)
                    } catch (error) {
                        toast.error(`Error deleting rule "${deleted[0].data.rule.id}".`)
                    }

                    // remove node from rules
                    // this should remove the node from the rules array, but messes up the tree layout
                    // const updatedRules = rules.filter((rule: Rules) => rule.id !== deleted[0].id);
                    // setRules(updatedRules);

                    return [...remainingEdges, ...createdEdges];
                }, edges),
            );
        },
        [nodes, edges],
    );

    const onConnect = useCallback(
        (params: any) => setEdges(addEdge(params, edges)),
        [edges],
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
                    onEdgesChange={onEdgesChange}
                    zoomOnDoubleClick={true}
                    zoomOnScroll={true}
                    zoomOnPinch={true}
                    onNodeDoubleClick={onNodeDoubleClick}
                    onNodesDelete={onNodesDelete}
                    onConnect={onConnect}
                    fitView
                    attributionPosition="top-right"
                    proOptions={treeOptions}
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
