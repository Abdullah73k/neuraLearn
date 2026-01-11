"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Edge } from "@xyflow/react";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { AppNode } from "@/types/nodes";

interface BeamOverlayProps {
	nodes: AppNode[];
	edges: Edge[];
	selectedNode: AppNode | null;
}

export function BeamOverlay({ nodes, edges, selectedNode }: BeamOverlayProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [beamPath, setBeamPath] = useState<{ from: string; to: string }[]>([]);
	const nodeRefs = useRef<Map<string, HTMLElement>>(new Map());
	const [refsReady, setRefsReady] = useState(false);

	// Find path from root to target node
	const findPath = useCallback(
		(targetId: string) => {
			const pathEdges: { from: string; to: string }[] = [];
			let currentId = targetId;

			let foundParent = true;
			while (foundParent) {
				foundParent = false;
				const parentEdge = edges.find((e) => e.target === currentId);
				if (parentEdge) {
					pathEdges.unshift({ from: parentEdge.source, to: parentEdge.target });
					currentId = parentEdge.source;
					foundParent = true;
				}
			}
			return pathEdges;
		},
		[edges]
	);

	// Update node refs when nodes change
	useEffect(() => {
		const updateRefs = () => {
			const map = new Map<string, HTMLElement>();
			nodes.forEach((node) => {
				const el = document.querySelector(
					`.react-flow__node[data-id="${node.id}"]`
				) as HTMLElement;
				if (el) {
					map.set(node.id, el);
				}
			});
			nodeRefs.current = map;
			setRefsReady(true);
		};

		const timer = setTimeout(updateRefs, 150);
		return () => clearTimeout(timer);
	}, [nodes, selectedNode]);

	// Update beam path when selection changes
	useEffect(() => {
		if (!selectedNode) {
			setBeamPath([]);
			return;
		}
		const path = findPath(selectedNode.id);
		setBeamPath(path);
	}, [selectedNode, findPath]);

	// Calculate total duration for all beams
	const beamDuration = 1.2;
	const totalPathDuration = beamPath.length * beamDuration;

	if (!selectedNode || beamPath.length === 0 || !refsReady) {
		return null;
	}

	return (
		<div
			ref={containerRef}
			className="absolute inset-0 pointer-events-none z-50 overflow-visible"
		>
			{beamPath.map((segment, index) => {
				const fromEl = nodeRefs.current.get(segment.from);
				const toEl = nodeRefs.current.get(segment.to);

				if (!fromEl || !toEl) return null;

				return (
					<AnimatedBeam
						key={`${segment.from}-${segment.to}-${selectedNode.id}`}
						containerRef={containerRef as React.RefObject<HTMLElement>}
						fromRef={{ current: fromEl } as React.RefObject<HTMLElement>}
						toRef={{ current: toEl } as React.RefObject<HTMLElement>}
						curvature={0}
						pathColor="#c4b5fd"
						pathWidth={3}
						pathOpacity={0.3}
						gradientStartColor="#c4b5fd"
						gradientStopColor="#a78bfa"
						duration={beamDuration}
						delay={index * (beamDuration * 0.6)}
					/>
				);
			})}
		</div>
	);
}
