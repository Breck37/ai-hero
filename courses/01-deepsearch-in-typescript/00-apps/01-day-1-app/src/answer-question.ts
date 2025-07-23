import { streamText, type StreamTextResult } from "ai";
import { model } from "../model";
import type { SystemContext } from "./system-context";

export const answerQuestion = (
  context: SystemContext,
  options: { isFinal?: boolean } = {},
): StreamTextResult<{}, string> => {
  const { isFinal = false } = options;

  const systemPrompt = `You are a helpful assistant that provides accurate, well-researched answers based on web search results and scraped content.

🔧 Your task is to answer the user's question using the information gathered from web searches and scraped content.

${isFinal ? "⚠️ IMPORTANT: We may not have all the information needed to answer this question completely, but please provide your best effort based on the available information." : ""}

💡 Guidelines:
• Use the search results and scraped content as your primary sources
• Cite sources with inline links when possible
• Provide comprehensive, well-structured answers
• If information is missing or unclear, acknowledge the limitations
• Be accurate and factual in your responses

🎯 Format your answer clearly with proper markdown formatting.`;

  return streamText({
    model,
    system: systemPrompt,
    prompt: `
User Question: ${context.getUserQuestion()}

${isFinal ? "Note: This is our final attempt to answer the question based on available information." : ""}

Here is the research context:

${context.getQueryHistory()}

${context.getScrapeHistory()}

Please provide a comprehensive answer to the user's question based on the information above.`,
  });
};
