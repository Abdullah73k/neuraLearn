"use client";

import { WorkspacesContainer } from "./workspaces-container";
import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
} from "@/components/ui/sidebar";
import { useMindMapActions, useGetWorkspaces } from "@/store/hooks";
import { RainbowButton } from "@/components/ui/rainbow-button";

export function WorkspacesSidebar() {
	const { createWorkspace } = useMindMapActions();
	const workspaces = useGetWorkspaces();
	return (
		<Sidebar
			collapsible="none"
			className="sticky top-0 hidden h-svh border-l lg:flex max-w-47"
			side="right"
		>
			<SidebarHeader>
				<RainbowButton
					onClick={() => {
						createWorkspace();
					}}
				>
					Add Workspace
				</RainbowButton>
			</SidebarHeader>
			<SidebarContent>
				<WorkspacesContainer workspaces={workspaces} />
			</SidebarContent>
		</Sidebar>
	);
}
