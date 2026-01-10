import { streamText, UIMessage, convertToModelMessages } from "ai";
import { google } from "@ai-sdk/google";
import { Edge } from "@xyflow/react";
import { getMongoDb, vectorSearch } from "@/lib/db/client";
import { generateEmbedding } from "@/lib/embeddings";
import { getUIState, getGraphSnapshot, buildGraphPrompt } from "@/lib/prompt-builder";
import { graphOrchestratorSystemPrompt } from "@/app/(server)/_relation-prompts/graph-orchestrator";
import { backgroundPrompt } from "@/app/(server)/_relation-prompts/background";
import type { Node } from "@/types/graph";

export const maxDuration = 60;

export async function POST(
	req: Request,
	{ params }: { params: Promise<{ nodeId: string }> }
) {
	try {
		const body = await req.json();
		const { messages, model, webSearch, edges } = body;

		console.log("Request body:", JSON.stringify(body, null, 2));
		console.log("Messages:", messages);

		if (!messages || !Array.isArray(messages)) {
			return new Response(
				JSON.stringify({ 
					error: "messages must be an array",
					received: typeof messages,
					body: body
				}),
				{ status: 400, headers: { "Content-Type": "application/json" } }
			);
		}

		const { nodeId } = await params;
		console.log("nodeId: ", nodeId);

		const db = await getMongoDb();
		
		// Get the active node to determine context
		const activeNode = await db.collection<Node>("nodes").findOne({ id: nodeId });
		
		if (!activeNode) {
			return new Response(
				JSON.stringify({ error: "Node not found" }),
				{ status: 404, headers: { "Content-Type": "application/json" } }
			);
		}

		const rootNodeId = activeNode.root_id;

		// Build graph context for the AI
		const uiState = await getUIState(rootNodeId, nodeId);
		const graphSnapshot = await getGraphSnapshot(rootNodeId, nodeId);

		// Get the latest user message
		const lastUserMessage = messages
			.filter((m: any) => m.role === "user")
			.pop()?.content || "";

		// Build conversation history for context
		const conversationHistory = messages.slice(-6).map((m: any) => ({
			role: m.role,
			content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
		}));

		// Build the context-aware prompt
		const contextPrompt = buildGraphPrompt({
			uiState,
			graphSnapshot,
			userMessage: lastUserMessage,
			conversationHistory,
		});

		// Determine system prompt based on whether we're at root or inside a node
		const systemPrompt = nodeId === rootNodeId
			? graphOrchestratorSystemPrompt
			: `${backgroundPrompt}\n\n${graphOrchestratorSystemPrompt}`;

		// Build tools configuration
		const tools: any = webSearch ? {
			google_search: google.tools.googleSearch({}),
		} : undefined;

		const result = streamText({
			model: google(model),
			messages: [
				{ role: "user", content: contextPrompt },
				...messages,
			],
			system: systemPrompt,
			tools,
		});

		return result.toTextStreamResponse();
	} catch (error) {
		console.error("Chat error:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to process chat",
				details: error instanceof Error ? error.message : "Unknown error",
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } }
		);
	}
}
