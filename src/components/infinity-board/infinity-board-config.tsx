import { Background, Controls, MiniMap } from "@xyflow/react";

export default function InfinityBoardConfig() {
	return (
		<>
			<Background />
			<Controls />
			<MiniMap bgColor="grey" zoomable pannable />
		</>
	);
}
