"use client";

import {
	ReactFlow,
	Node,
	Edge,
	useNodesState,
	useEdgesState,
	OnConnect,
	addEdge,
	ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const initialNodes: Node[] = [
	{
		id: "n1",
		position: { x: 0, y: 0 },
		data: { label: "Node 1" },
		type: "input",
	},
	{
		id: "n2",
		position: { x: 100, y: 100 },
		data: { label: "Node 2" },
	},
];

const initialEdges: Edge[] = [
	{
		id: "n1-n2",
		source: "n1",
		target: "n2",
	},
];

export default function InfinityBoard({
	children,
}: {
	children?: React.ReactNode;
}) {
	const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
	const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

	const onConnect: OnConnect = (params) =>
		setEdges((edges) => addEdge(params, edges));

	return (
		<ReactFlowProvider>
			<div style={{ width: "100vw", height: "100vh" }}>
				<ReactFlow
					nodes={nodes}
					edges={edges}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					onConnect={onConnect}
					// This gives u info of the node u click on
					onSelectionChange={console.log}
					fitView
				>
					{children}
				</ReactFlow>
			</div>
		</ReactFlowProvider>
	);
}
