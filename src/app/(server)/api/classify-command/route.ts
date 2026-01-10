import { NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

export const maxDuration = 60;

type NodeInfo = {
  id: string;
  title: string;
  type: string;
};

type CommandType =
  | "create_node"
  | "delete_node"
  | "copy_response"
  | "navigate_to"
  | "connect_nodes"
  | "unknown";

type ClassifiedCommand = {
  command: CommandType;
  params: Record<string, string>;
  confidence: number;
  explanation: string;
};

export async function POST(req: Request) {
  try {
    const { transcription, nodes, currentRelationType } = await req.json();

    if (!transcription) {
      return NextResponse.json(
        { error: "No transcription provided" },
        { status: 400 }
      );
    }

    // Build node list for context
    const nodeList = (nodes as NodeInfo[])
      .map((n) => `- "${n.title}" (id: ${n.id}, type: ${n.type})`)
      .join("\n");

    const rootNode = (nodes as NodeInfo[]).find((n) => n.type === "root");

    const prompt = `You are a voice command classifier for a mind mapping application. Given a user's spoken command and the current nodes in the graph, classify the command into one of these categories and extract the relevant parameters.

## Available Commands:
1. **create_node** - Create a new node connected to an existing node
   - Parameters: source_node_id (the node to branch from), new_node_title (title for the new node)
   - Example: "Create a node about derivatives from calculus" → create_node with source being the calculus node

2. **delete_node** - Delete an existing node
   - Parameters: target_node_id (the node to delete)
   - Example: "Delete the derivatives node" → delete_node with target being derivatives

3. **copy_response** - Copy the chat response text from a node
   - Parameters: target_node_id (the node to copy from)
   - Example: "Copy the response from the integration node" → copy_response

4. **navigate_to** - Select/navigate to a specific node
   - Parameters: target_node_id (the node to navigate to)
   - Example: "Go to the calculus node" → navigate_to

5. **connect_nodes** - Connect two existing nodes
   - Parameters: source_node_id, target_node_id
   - Example: "Connect derivatives to integration" → connect_nodes

6. **unknown** - Command cannot be understood or doesn't fit any category

## Current Nodes in Graph:
${nodeList || "No nodes available"}

## Root Node (default source if not specified):
${rootNode ? `"${rootNode.title}" (id: ${rootNode.id})` : "None"}

## Current Relation Type for new connections:
${currentRelationType}

## User's Spoken Command:
"${transcription}"

## Instructions:
- Match node references semantically (e.g., "calc" matches "Calculus", "deriv" matches "Derivatives")
- If creating a node and no source is specified, use the root node as the source
- Be generous in interpretation - the user is speaking, so there may be speech-to-text errors
- Return a confidence score from 0 to 1

Respond with ONLY valid JSON in this exact format:
{
  "command": "create_node" | "delete_node" | "copy_response" | "navigate_to" | "connect_nodes" | "unknown",
  "params": {
    "source_node_id": "uuid if applicable",
    "target_node_id": "uuid if applicable",
    "new_node_title": "title if creating node"
  },
  "confidence": 0.95,
  "explanation": "Brief explanation of the interpretation"
}`;

    const result = await generateText({
      model: google("gemini-2.0-flash"),
      prompt,
    });

    const responseText = result.text || "";
    
    // Extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Failed to parse command response:", responseText);
      return NextResponse.json(
        { error: "Failed to parse command classification" },
        { status: 500 }
      );
    }

    const classifiedCommand: ClassifiedCommand = JSON.parse(jsonMatch[0]);

    console.log("Classified command:", classifiedCommand);

    return NextResponse.json(classifiedCommand);
  } catch (error) {
    console.error("Command classification error:", error);
    return NextResponse.json(
      {
        error: `Internal server error: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
