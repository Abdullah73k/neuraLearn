"use client";

import { type MindMapEdge } from "@/types/edges";
import { BezierEdge, EdgeProps, getBezierPath } from "@xyflow/react";
import { motion } from "motion/react";

// Single unified edge color - gray
export const EDGE_COLOR = "#cbd5e1"; // slate-300

export default function MindMapEdge({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	data,
}: EdgeProps<MindMapEdge>) {
	const isAnimated = data?.isAnimated || false;

	// DEBUG: Log edge rendering state with actual values
	console.log(
		`[EdgeRender] Edge ${id}: isAnimated=${isAnimated}, relationType=${data?.relationType}`
	);

	const [edgePath] = getBezierPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
	});

	if (!isAnimated) {
		return (
			<BezierEdge
				id={id}
				sourceX={sourceX}
				sourceY={sourceY}
				targetX={targetX}
				targetY={targetY}
				sourcePosition={sourcePosition}
				targetPosition={targetPosition}
				style={{
					stroke: EDGE_COLOR,
					strokeWidth: 2,
				}}
				markerEnd="url(#arrow)"
			/>
		);
	}

	// Animated edge with pulsing beam
	return (
		<>
			{/* Base path - gray */}
			<path
				id={id}
				d={edgePath}
				fill="none"
				stroke={EDGE_COLOR}
				strokeWidth={2}
				markerEnd="url(#arrow)"
			/>
			{/* Animated gradient overlay */}
			<motion.path
				d={edgePath}
				fill="none"
				stroke={`url(#beam-gradient-${id})`}
				strokeWidth={4}
				strokeLinecap="round"
				style={{ pointerEvents: "none" }}
			/>
			<defs>
				<motion.linearGradient
					id={`beam-gradient-${id}`}
					gradientUnits="objectBoundingBox"
					initial={{ x1: 0, y1: 0, x2: 0, y2: 0 }}
					animate={{
						x1: [0, 1],
						y1: [0, 0],
						x2: [0.3, 1.3],
						y2: [0, 0],
					}}
					transition={{
						duration: 1.5,
						repeat: Infinity,
						ease: "linear",
					}}
				>
					<stop offset="0" stopColor="#c4b5fd" stopOpacity="0" />
					<stop offset="0.3" stopColor="#c4b5fd" stopOpacity="0.9" />
					<stop offset="0.5" stopColor="#a78bfa" stopOpacity="1" />
					<stop offset="0.7" stopColor="#c4b5fd" stopOpacity="0.9" />
					<stop offset="1" stopColor="#c4b5fd" stopOpacity="0" />
				</motion.linearGradient>
			</defs>
		</>
	);
}
