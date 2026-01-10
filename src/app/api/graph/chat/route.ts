import { NextRequest, NextResponse } from "next/server";
import { orchestrateGraphChat } from "@/lib/ai-orchestrator";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequestBody {
  message: string;
  rootNodeId: string;
  activeNodeId?: string | null;
  history?: Array<{ role: string; content: string }>;
}

/**
 * POST /api/graph/chat
 * 
 * Main chat endpoint for the knowledge graph tutor.
 * Handles:
 * - Searching for existing nodes
 * - Creating new nodes when topics don't exist
 * - Activating relevant nodes
 * - Returning activation paths for UI animations
 */
export async function POST(req: NextRequest) {
  try {
    const body: ChatRequestBody = await req.json();

    // Validate required fields
    if (!body.message) {
      return NextResponse.json(
        { error: "Missing required field: message" },
        { status: 400 }
      );
    }

    if (!body.rootNodeId) {
      return NextResponse.json(
        { error: "Missing required field: rootNodeId" },
        { status: 400 }
      );
    }

    // Orchestrate the chat
    const result = await orchestrateGraphChat({
      userMessage: body.message,
      rootNodeId: body.rootNodeId,
      activeNodeId: body.activeNodeId || null,
      conversationHistory: body.history || [],
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Graph chat API error:", error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        );
      }

      if (error.message.includes("ANTHROPIC_API_KEY")) {
        return NextResponse.json(
          { error: "AI service not configured" },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      {
        error: "Failed to process message",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/graph/chat
 * 
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "neuralearn-graph-chat",
    timestamp: new Date().toISOString(),
  });
}
