"use client";

import { useMemo } from "react";

import { nodeTypes } from "@/lib/node-types-map";
import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import InfinityBoardConfig from "./infinity-board-config";
import {
	useGetActiveWorkspace,
	useGetCurrentRelationType,
	useGetSelectedNode,
	useIsChatBarOpen,
	useMindMapActions,
} from "@/store/hooks";
import { edgeTypes } from "@/lib/edge-types-map";
import { EDGE_COLOR } from "../edges/mindmap-edge";
import GlobalMic from "../global-mic/global-mic";

export default function InfinityBoard() {
	const {
		setSelectedNode,
		onConnectForActive,
		onNodesChangeForActive,
		onEdgesChangeForActive,
		setIsChatBarOpen,
		closeChatBar,
	} = useMindMapActions();
	const selectedNode = useGetSelectedNode();
	const isChatBarOpen = useIsChatBarOpen();
	const relationType = useGetCurrentRelationType();

	const activeWorkspace = useGetActiveWorkspace();
	const nodes = activeWorkspace?.nodes || [];
	const edges = activeWorkspace?.edges || [];
	const onNodesChange = onNodesChangeForActive;
	const onEdgesChange = onEdgesChangeForActive;
	const onConnect = onConnectForActive;

	// Find path from root to selected node and mark edges as animated
	const edgesWithAnimation = useMemo(() => {
		if (!selectedNode) return edges;

		// Build parent map: child -> parent edge
		// In this graph: edge.source = child, edge.target = parent
		const childToParentEdge = new Map<string, (typeof edges)[0]>();
		edges.forEach((edge) => {
			// Only keep the FIRST parent edge for each child
			// This prevents ambiguity if a node somehow has multiple parents
			if (!childToParentEdge.has(edge.source)) {
				childToParentEdge.set(edge.source, edge);
			}
		});

		// === DEBUG: Node Analysis ===
		console.group("[BeamDebug] Graph Analysis");

		// Calculate incoming edge counts for each node
		const incomingCounts = new Map<string, number>();
		const outgoingCounts = new Map<string, number>();
		nodes.forEach((node) => {
			incomingCounts.set(node.id, 0);
			outgoingCounts.set(node.id, 0);
		});
		edges.forEach((edge) => {
			// Remember: source = child, target = parent
			incomingCounts.set(
				edge.source,
				(incomingCounts.get(edge.source) || 0) + 1
			);
			outgoingCounts.set(
				edge.target,
				(outgoingCounts.get(edge.target) || 0) + 1
			);
		});

		console.log(
			"Node incoming edge counts:",
			Array.from(incomingCounts.entries()).map(([id, count]) => ({
				id,
				count,
				label: nodes.find((n) => n.id === id)?.data?.title || "unknown",
			}))
		);

		const rootNodes = Array.from(incomingCounts.entries())
			.filter(([_, count]) => count === 0)
			.map(([id]) => id);
		console.log(
			"Detected root nodes (0 incoming edges):",
			rootNodes.map((id) => ({
				id,
				label: nodes.find((n) => n.id === id)?.data?.title || "unknown",
			}))
		);

		console.log(
			"Parent map (child → parent):",
			Array.from(childToParentEdge.entries()).map(([child, edge]) => ({
				childId: child,
				childLabel: nodes.find((n) => n.id === child)?.data?.title || "unknown",
				parentId: edge.target,
				parentLabel:
					nodes.find((n) => n.id === edge.target)?.data?.title || "unknown",
				edgeId: edge.id,
			}))
		);

		console.groupEnd();

		// === DEBUG: Selection ===
		console.group("[BeamDebug] Selection & Traversal");
		console.log("Selected node:", {
			id: selectedNode.id,
			label: selectedNode.data?.title || "unknown",
			type: selectedNode.type,
		});

		// Traverse from selected node UP to root, collecting edge IDs
		const pathEdgeIds = new Set<string>();
		const ancestryPath: string[] = [selectedNode.id]; // Track node IDs in order
		let currentNodeId = selectedNode.id;
		const visited = new Set<string>(); // Prevent cycles
		let maxIterations = 100; // Safety limit

		while (maxIterations-- > 0) {
			if (visited.has(currentNodeId)) {
				console.warn(
					"[BeamDebug] CYCLE DETECTED - stopping traversal at node:",
					currentNodeId
				);
				break;
			}
			visited.add(currentNodeId);

			const parentEdge = childToParentEdge.get(currentNodeId);
			if (!parentEdge) {
				console.log("[BeamDebug] Reached ROOT (no parent edge) at node:", {
					id: currentNodeId,
					label:
						nodes.find((n) => n.id === currentNodeId)?.data?.title || "unknown",
				});
				break;
			}

			console.log("[BeamDebug] Found parent edge:", {
				edgeId: parentEdge.id,
				childId: parentEdge.source,
				childLabel:
					nodes.find((n) => n.id === parentEdge.source)?.data?.title ||
					"unknown",
				parentId: parentEdge.target,
				parentLabel:
					nodes.find((n) => n.id === parentEdge.target)?.data?.title ||
					"unknown",
			});

			pathEdgeIds.add(parentEdge.id);
			ancestryPath.push(parentEdge.target); // Add parent to path
			currentNodeId = parentEdge.target; // Move to parent
		}

		// Reverse path to show root → selected
		const rootToSelectedPath = [...ancestryPath].reverse();
		console.log(
			"[BeamDebug] Complete ancestry path (root → selected):",
			rootToSelectedPath.map((id) => ({
				id,
				label: nodes.find((n) => n.id === id)?.data?.title || "unknown",
			}))
		);
		console.log(
			"[BeamDebug] Edges to animate:",
			Array.from(pathEdgeIds).map((edgeId) => {
				const edge = edges.find((e) => e.id === edgeId);
				return edge
					? {
							edgeId,
							childId: edge.source,
							childLabel:
								nodes.find((n) => n.id === edge.source)?.data?.title ||
								"unknown",
							parentId: edge.target,
							parentLabel:
								nodes.find((n) => n.id === edge.target)?.data?.title ||
								"unknown",
					  }
					: { edgeId, error: "edge not found" };
			})
		);
		console.groupEnd();

		// === DEBUG: Edge Marking ===
		console.group("[BeamDebug] Edge Animation Decisions");
		let animatedCount = 0;
		let skippedCount = 0;

		// Mark edges in path as animated
		const result = edges.map((edge) => {
			const isAnimated = pathEdgeIds.has(edge.id);

			if (isAnimated) {
				animatedCount++;
				console.log(`✅ ANIMATING edge ${edge.id}:`, {
					childId: edge.source,
					childLabel:
						nodes.find((n) => n.id === edge.source)?.data?.title || "unknown",
					parentId: edge.target,
					parentLabel:
						nodes.find((n) => n.id === edge.target)?.data?.title || "unknown",
					reason: "on ancestry path",
				});
			} else {
				skippedCount++;
				if (skippedCount <= 3) {
					// Only log first 3 skipped edges to avoid spam
					console.log(`❌ SKIPPING edge ${edge.id}:`, {
						childId: edge.source,
						childLabel:
							nodes.find((n) => n.id === edge.source)?.data?.title || "unknown",
						parentId: edge.target,
						parentLabel:
							nodes.find((n) => n.id === edge.target)?.data?.title || "unknown",
						reason: "not on ancestry path",
					});
				}
			}

			return {
				...edge,
				data: {
					...edge.data,
					isAnimated,
				},
			};
		});

		console.log(
			`[BeamDebug] Summary: ${animatedCount} edges animated, ${skippedCount} edges skipped`
		);
		console.groupEnd();

		// === DEBUG: Final State Verification ===
		console.group("[BeamDebug] Final Edge State");
		console.log("Edge IDs that SHOULD animate:", Array.from(pathEdgeIds));
		console.log(
			"All edges being passed to React Flow:",
			result.map((e) => ({
				id: e.id,
				source: e.source,
				target: e.target,
				isAnimated: e.data?.isAnimated || false,
				sourceLabel:
					nodes.find((n) => n.id === e.source)?.data?.title || "unknown",
				targetLabel:
					nodes.find((n) => n.id === e.target)?.data?.title || "unknown",
			}))
		);

		// Verify each edge in pathEdgeIds has isAnimated = true
		const mismatches: string[] = [];
		pathEdgeIds.forEach((edgeId) => {
			const edge = result.find((e) => e.id === edgeId);
			if (!edge?.data?.isAnimated) {
				mismatches.push(edgeId);
			}
		});
		if (mismatches.length > 0) {
			console.error(
				"[BeamDebug] ERROR: These edges SHOULD be animated but are NOT:",
				mismatches
			);
		}

		// Verify no extra edges have isAnimated = true
		const extras: string[] = [];
		result.forEach((edge) => {
			if (edge.data?.isAnimated && !pathEdgeIds.has(edge.id)) {
				extras.push(edge.id);
			}
		});
		if (extras.length > 0) {
			console.error(
				"[BeamDebug] ERROR: These edges should NOT be animated but ARE:",
				extras
			);
		}

		if (mismatches.length === 0 && extras.length === 0) {
			console.log(
				"[BeamDebug] ✅ Edge state is CORRECT - all path edges marked, no extras"
			);
		}
		console.groupEnd();

		return result;
	}, [edges, selectedNode]);

	if (!activeWorkspace) {
		return (
			<div className="flex justify-center items-center">
				<p className="text-mono text-pretty text-purple-500 text-lg">
					Select or create a workspace to get started!
				</p>
			</div>
		);
	}

	return (
		<ReactFlowProvider>
			<div
				className="m-auto"
				style={{
					width: `${isChatBarOpen ? "50dvw" : "80dvw"}`,
					height: "100dvh",
				}}
			>
				<ReactFlow
					nodes={nodes}
					edges={edgesWithAnimation}
					nodeTypes={nodeTypes}
					edgeTypes={edgeTypes}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					onConnect={onConnect}
					defaultEdgeOptions={{
						type: "mindmap",
						style: {
							stroke: EDGE_COLOR,
							strokeWidth: 2,
						},
					}}
					// This gives u info of the node u click on
					onSelectionChange={({ nodes }) => {
						const selectedNode = nodes[0] ? nodes[0] : null;
						console.log("Selected Node: ", selectedNode);
						setSelectedNode(selectedNode);
						if (selectedNode && selectedNode.type === "subtopic") {
							setIsChatBarOpen();
						} else {
							closeChatBar();
						}
					}}
					fitViewOptions={{ padding: 0.2 }}
					fitView
				>
					<InfinityBoardConfig selectedNode={selectedNode} />
				</ReactFlow>
				<GlobalMic />
			</div>
		</ReactFlowProvider>
	);
}
