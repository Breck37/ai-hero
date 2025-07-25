import { z } from "zod";
import { generateObject } from "ai";
import { model } from "../model";
import type { SystemContext } from "./system-context";
import type { SearchResult } from "./types";

type SearchAction = {
  type: "search";
  query: string;
  title: string;
  reasoning: string;
  results: SearchResult[];
};

type AnswerAction = {
  type: "answer";
  title: string;
  reasoning: string;
};

type Action = SearchAction | AnswerAction;

export type { Action };
export const actionSchema = z.object({
  type: z.enum(["search", "answer"]).describe(
    `The type of action to take.
      - 'search': Search the web for more information, returning URLs, snippets, and scraped content.
      - 'answer': Answer the user's question and complete the loop.`,
  ),
  title: z
    .string()
    .describe(
      "The title of the action, to be displayed in the UI. Be extremely concise. 'Searching Saka's injury history', 'Comparing toaster ovens'",
    ),
  reasoning: z.string().describe("The reason you chose this step."),
  query: z
    .string()
    .describe("The query to search for. Required if type is 'search'.")
    .optional(),
  results: z
    .array(
      z.object({
        date: z.string(),
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
        scrapedContent: z.string(),
      }),
    )
    .describe(
      "The search results, including scraped content. Required if type is 'search'.",
    )
    .optional(),
});

export const getNextAction = async (
  context: SystemContext,
  langfuseTraceId?: string,
) => {
  const result = await generateObject({
    model,
    schema: actionSchema,
    system: `You are a helpful assistant that can search the web (and always scrape the results) or answer the user's question.

${context.getLocationPrompt()}

🔧 MANDATORY SEARCH WORKFLOW:
1. Use 'search' to find relevant URLs (aim for 2+ sources) and always scrape the full content from each result.
2. ONLY THEN: Use 'answer' to provide a detailed answer based on the scraped content.

💡 Search when users ask about:
• Current events, news, or recent developments
• Time-sensitive factual information  
• Specific products, companies, or people
• Recommendations or reviews
• Weather, sports, or real-time data
• Location-based queries (restaurants, events, services near the user)

⚡ CRITICAL RULES:
- NEVER answer without first searching and scraping
- Search snippets are NOT enough - you MUST scrape the full content
- Always follow the 2-step process: search (with scrape) → answer
- Consider the conversation history when making decisions - follow-up questions should build on previous context
- For location-based queries, include the user's location in your search terms

🎯 PRO TIP: Cite sources with inline links and provide details from multiple perspectives when possible!`,
    prompt: `
Conversation History:
${context.getConversationHistory()}

Current User Question: ${context.getUserQuestion()}

DECISION RULES:
- If you have NO search results yet → use 'search'
- If you have search results → use 'answer'
- For follow-up questions, consider if you need to search for more specific information

Current state:
- Search results: ${context.hasSearchResults() ? "Available" : "None"}

Here is the research context:

${context.getSearchHistory()}
    `,
    experimental_telemetry: langfuseTraceId
      ? {
          isEnabled: true,
          functionId: "agent-get-next-action",
          metadata: {
            langfuseTraceId,
          },
        }
      : undefined,
  });

  return result.object;
};
