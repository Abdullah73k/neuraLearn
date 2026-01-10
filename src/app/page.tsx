"use client";

import { ChatSidebar } from "@/components/ai-interface/chat/chat-sidebar";
import InfinityBoard from "@/components/infinity-board/infinity-board";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useIsChatBarOpen, useMindMapActions } from "@/store/hooks";
import { WorkspacesSidebar } from "@/components/ai-interface/workspace/workspace-sidebar";
import { useEffect } from "react";

export default function Page() {
	const isChatBarOpen = useIsChatBarOpen();
	const { setIsChatBarOpen, loadWorkspacesFromDb } = useMindMapActions();

	// Load workspaces from MongoDB on mount
	useEffect(() => {
		loadWorkspacesFromDb();
	}, [loadWorkspacesFromDb]);

	return (
		<SidebarProvider
			style={
				{
					"--sidebar-width": "34rem",
				} as React.CSSProperties
			}
			open={isChatBarOpen}
			onOpenChange={setIsChatBarOpen}
		>
			<ChatSidebar />
			<SidebarInset className="flex justify-center items-center">
				<InfinityBoard />
			</SidebarInset>
			<WorkspacesSidebar />
		</SidebarProvider>
	);
}
