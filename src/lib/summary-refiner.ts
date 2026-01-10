import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ConversationContext {
  userQuestions: string[];
  aiResponses: string[];
  nodeTitle: string;
  currentSummary: string;
  parentSummary?: string;
}

/**
 * Refine a node's summary based on actual student interactions
 * This is called automatically every N interactions to improve the summary
 */
export async function refineNodeSummary(
  nodeId: string,
  context: ConversationContext
): Promise<string> {
  // Build recent exchanges (limit to 5 for token efficiency)
  const recentExchanges = context.userQuestions
    .slice(0, 5)
    .map((q, i) => {
      const response = context.aiResponses[i] || "";
      return `Q: ${q.slice(0, 200)}${q.length > 200 ? "..." : ""}\nA: ${response.slice(0, 300)}${response.length > 300 ? "..." : ""}`;
    })
    .join("\n\n");

  const prompt = `You are refining a knowledge graph node summary based on real student interactions.

## Node Information
Title: "${context.nodeTitle}"
Current Summary: "${context.currentSummary}"
${context.parentSummary ? `Parent Topic Summary: "${context.parentSummary}"` : ""}

## Recent Student Interactions
${recentExchanges}

## Task
Write an IMPROVED 1-2 sentence summary (max 200 characters) that:
1. Captures what students actually ask about most
2. Addresses common confusion points shown in the questions
3. Maintains technical accuracy
4. Uses student-friendly language
5. Connects to the parent topic context if relevant

## Rules
- Maximum 2 sentences
- Maximum 200 characters total
- Clear, concise language
- No jargon unless necessary
- Action-oriented when possible

Return ONLY the refined summary text. No explanations, no formatting, no quotes.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    if (!textBlock) {
      console.error("No text in summary refinement response");
      return context.currentSummary;
    }

    const refined = textBlock.text.trim();

    // Validate refined summary
    if (refined.length < 20 || refined.length > 250) {
      console.warn("Refined summary length out of bounds, keeping original");
      return context.currentSummary;
    }

    return refined;
  } catch (error) {
    console.error("Summary refinement failed:", error);
    return context.currentSummary;
  }
}

/**
 * Generate initial summary for a new node based on context
 * Used when AI doesn't provide a good summary in create_node
 */
export async function generateInitialSummary(
  title: string,
  userMessage: string,
  parentContext?: { title: string; summary: string }
): Promise<string> {
  const prompt = parentContext
    ? `Given the parent topic "${parentContext.title}" (${parentContext.summary}), write a 1-2 sentence summary for the subtopic "${title}" based on this user question: "${userMessage}".

Format: Clear, student-friendly definition. Max 200 characters.`
    : `Write a 1-2 sentence summary for the topic "${title}" based on this context: "${userMessage}".

Format: Clear, student-friendly definition. Max 200 characters.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    if (!textBlock) {
      return `Introduction to ${title}`;
    }

    return textBlock.text.trim().slice(0, 200);
  } catch (error) {
    console.error("Initial summary generation failed:", error);
    return `Introduction to ${title}`;
  }
}
