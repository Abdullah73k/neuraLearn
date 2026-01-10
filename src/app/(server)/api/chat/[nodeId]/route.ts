import { streamText, UIMessage, convertToModelMessages } from "ai";
import { google } from "@ai-sdk/google";
import { Edge } from "@xyflow/react";
import { getMongoDb } from "@/lib/db/client";
import { getUIState, getGraphSnapshot, buildGraphPrompt } from "@/lib/prompt-builder";
import { graphOrchestratorSystemPrompt } from "@/app/(server)/_relation-prompts/graph-orchestrator";
import { backgroundPrompt } from "@/app/(server)/_relation-prompts/background";
import { graphTools } from "@/lib/graph-tools";
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
        console.log("edges: ", edges);

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
        const isAtRoot = nodeId === rootNodeId;

        // Build graph context for the AI
        const uiState = await getUIState(rootNodeId, nodeId);
        const graphSnapshot = await getGraphSnapshot(rootNodeId, nodeId);

        // Get the latest user message
        const lastUserMessage = messages
            .filter((m: UIMessage) => m.role === "user")
            .pop()?.content?.toString() || "";

        // Build conversation history for context
        const conversationHistory = messages.slice(-6).map((m: UIMessage) => ({
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
        const systemPrompt = isAtRoot
            ? graphOrchestratorSystemPrompt
            : `${backgroundPrompt}\n\n${graphOrchestratorSystemPrompt}`;

        // Build tools configuration - always include graph tools
        const tools: any = {
            search_nodes: graphTools.search_nodes,
            get_node: graphTools.get_node,
            create_node: graphTools.create_node,
            get_path_to_root: graphTools.get_path_to_root,
        };

        // Optionally add web search
        if (webSearch) {
            tools.google_search = google.tools.googleSearch({});
        }

        // Convert messages and prepend context
        const convertedMessages = convertToModelMessages(messages);
        const messagesWithContext = [
            { role: "system" as const, content: contextPrompt },
            ...convertedMessages,
        ];

        const result = streamText({
            model: google(model),
            messages: messagesWithContext,
            system: systemPrompt,
            tools,
            maxSteps: 5, // Allow multi-step tool usage
            toolChoice: "auto",
        });

        // Send sources and reasoning back to the client (for voice agent)
        return result.toDataStreamResponse({
            sendUsage: true,
        });
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