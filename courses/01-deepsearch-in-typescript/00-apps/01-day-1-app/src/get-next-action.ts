import { z } from "zod";
import { generateObject } from "ai";
import { model } from "../model";
import type { SystemContext } from "./system-context";

export interface SearchAction {
  type: "search";
  query: string;
  title: string;
  reasoning: string;
}

export interface ScrapeAction {
  type: "scrape";
  urls: string[];
  title: string;
  reasoning: string;
}

export interface AnswerAction {
  type: "answer";
  title: string;
  reasoning: string;
}

export type Action = SearchAction | ScrapeAction | AnswerAction;

export const actionSchema = z.object({
  type: z.enum(["search", "scrape", "answer"]).describe(
    `The type of action to take.
      - 'search': Search the web for more information.
      - 'scrape': Scrape a URL.
      - 'answer': Answer the user's question and complete the loop.`,
  ),
  title: z
    .string()
    .describe(
      "The title of the action, to be displayed in the UI. Be extremely concise. 'Searching Saka's injury history', 'Checking HMRC industrial action', 'Comparing toaster ovens'",
    ),
  reasoning: z.string().describe("The reason you chose this step."),
  query: z
    .string()
    .describe("The query to search for. Required if type is 'search'.")
    .optional(),
  urls: z
    .array(z.string())
    .describe("The URLs to scrape. Required if type is 'scrape'.")
    .optional(),
});

export const getNextAction = async (
  context: SystemContext,
  langfuseTraceId?: string,
) => {
  const result = await generateObject({
    model,
    schema: actionSchema,
    system: `You are a helpful assistant that can search the web, scrape a URL, or answer the user's question.

🔧 MANDATORY SEARCH WORKFLOW:
1. FIRST: Use 'search' to find relevant URLs (aim for 2+ sources)
2. SECOND: Use 'scrape' to extract full content from the best URLs from your search results
3. ONLY THEN: Use 'answer' to provide a detailed answer based on the scraped content

💡 Search when users ask about:
• Current events, news, or recent developments
• Time-sensitive factual information  
• Specific products, companies, or people
• Recommendations or reviews
• Weather, sports, or real-time data

⚡ CRITICAL RULES:
- NEVER answer without first searching AND scraping
- Search snippets are NOT enough - you MUST scrape the full content
- Always follow the 3-step process: search → scrape → answer
- If you have search results but no scraped content, you MUST scrape next

🎯 PRO TIP: Cite sources with inline links and provide details from multiple perspectives when possible!`,
    prompt: `
User Question: ${context.getUserQuestion()}

DECISION RULES:
- If you have NO search results yet → use 'search'
- If you have search results but NO scraped content → use 'scrape' with URLs from your search results
- If you have BOTH search results AND scraped content → use 'answer'

Current state:
- Search results: ${context.hasSearchResults() ? "Available" : "None"}
- Scraped content: ${context.hasScrapedContent() ? "Available" : "None"}

Here is the context:

${context.getQueryHistory()}

${context.getScrapeHistory()}
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
