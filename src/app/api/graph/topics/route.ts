import { NextRequest, NextResponse } from "next/server";
import { getMongoDb } from "@/lib/db/client";
import { createNodeEmbedding } from "@/lib/embeddings";
import type { RootTopic, Node } from "@/types/graph";

export const runtime = "nodejs";

interface CreateTopicBody {
  title: string;
  description?: string;
}

/**
 * POST /api/graph/topics
 * 
 * Create a new root topic (e.g., "Calculus", "Machine Learning")
 * This creates:
 * 1. A root topic document in MongoDB
 * 2. A root node with embedding for vector search
 */
export async function POST(req: NextRequest) {
  try {
    const body: CreateTopicBody = await req.json();

    if (!body.title || body.title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const title = body.title.trim();
    const description = body.description?.trim() || `Learn about ${title}`;

    const db = await getMongoDb();
    const topicId = crypto.randomUUID();

    // Check if topic with same title exists
    const existing = await db
      .collection<RootTopic>("root_topics")
      .findOne({ title: { $regex: new RegExp(`^${title}$`, "i") } });

    if (existing) {
      return NextResponse.json(
        { error: "A topic with this title already exists", existingId: existing.id },
        { status: 409 }
      );
    }

    // Create root topic document
    const rootTopic: Omit<RootTopic, "_id"> = {
      id: topicId,
      title,
      description,
      node_count: 1, // Root node counts as 1
      created_at: new Date(),
    };

    await db.collection("root_topics").insertOne(rootTopic);

    // Generate embedding for root node
    const embedding = await createNodeEmbedding(title, description);

    // Create root node with embedding
    const rootNode: Omit<Node, "_id"> = {
      id: topicId,
      title,
      summary: description,
      parent_id: null,
      root_id: topicId,
      tags: [],
      embedding,
      interaction_count: 0,
      last_refined_at: new Date(),
      created_at: new Date(),
      children_ids: [],
      ancestor_path: [topicId],
    };

    await db.collection("nodes").insertOne(rootNode);

    return NextResponse.json({
      success: true,
      topic: {
        id: topicId,
        title,
        description,
      },
    });
  } catch (error) {
    console.error("Create topic error:", error);
    return NextResponse.json(
      {
        error: "Failed to create topic",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/graph/topics
 * 
 * List all root topics
 */
export async function GET() {
  try {
    const db = await getMongoDb();

    const topics = await db
      .collection<RootTopic>("root_topics")
      .find({})
      .sort({ created_at: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      success: true,
      topics: topics.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        node_count: t.node_count,
        created_at: t.created_at,
      })),
    });
  } catch (error) {
    console.error("List topics error:", error);
    return NextResponse.json(
      { error: "Failed to list topics" },
      { status: 500 }
    );
  }
}
