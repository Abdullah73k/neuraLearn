import {
	Menubar,
	MenubarContent,
	MenubarItem,
	MenubarMenu,
	MenubarTrigger,
} from "@/components/ui/menubar";
import { Panel } from "@xyflow/react";
import MenubarOption from "./menubar-option";
import { useMindMapActions } from "@/store/hooks";

export default function PanelTopMiddle() {
	const { createSubtopicNode, createNoteNode } = useMindMapActions();
	return (
		<Panel position="top-center">
			<Menubar className="py-4">
				<MenubarOption option="Add Node" onClick={createSubtopicNode} />
				<MenubarOption option="Add Note" onClick={createNoteNode} />
			</Menubar>
		</Panel>
	);
}
