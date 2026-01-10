import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { Panel } from "@xyflow/react";

export default function PanelTopMiddle() {
	return (
		<Panel position="top-center">
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem className="hidden md:block">
						<BreadcrumbLink className="text-lg text-mono text-cyan-500 font-light">
							Building Your Application
						</BreadcrumbLink>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
		</Panel>
	);
}
