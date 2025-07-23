import { z } from "zod";
import { generateObject } from "ai";
import { model } from "../model";
import type { SystemContext } from "./system-context";

export interface SearchAction {
  type: "search";
  query: string;
}

export interface ScrapeAction {
  type: "scrape";
  urls: string[];
}

export interface AnswerAction {
  type: "answer";
}

export type Action = SearchAction | ScrapeAction | AnswerAction;

export const actionSchema = z.object({
  type: z.enum(["search", "scrape", "answer"]).describe(
    `The type of action to take.
      - 'search': Search the web for more information.
      - 'scrape': Scrape a URL.
      - 'answer': Answer the user's question and complete the loop.`,
  ),
  query: z
    .string()
    .describe("The query to search for. Required if type is 'search'.")
    .optional(),
  urls: z
    .array(z.string())
    .describe("The URLs to scrape. Required if type is 'scrape'.")
    .optional(),
});

export const getNextAction = async (context: SystemContext) => {
  const result = await generateObject({
    model,
    schema: actionSchema,
    system: `You are a helpful assistant that can search the web, scrape a URL, or answer the user's question.

🔧 SEARCH WORKFLOW (2-step process):
1. Use search to find relevant URLs (aim for 2+ sources)
2. Use scrape to extract full content from the best URLs

💡 Search when users ask about:
• Current events, news, or recent developments
• Time-sensitive factual information  
• Specific products, companies, or people
• Recommendations or reviews
• Weather, sports, or real-time data

⚡ CRITICAL: Never rely on search snippets alone! Always use scrape to get full article content for accuracy and completeness.

🎯 PRO TIP: Cite sources with inline links and provide details from multiple perspectives when possible!`,
    prompt: `
User Question: ${context.getUserQuestion()}

Based on this context, choose the right next action. 

1) If you need more information, use 'search' with a relevant search query.
2) if you have URLs that need to be scraped, use 'scrape' with those URLs
3) If you have enough information, use 'answer' to provide a detailed answer to the user's inquiry

Here is the context:

${context.getQueryHistory()}

${context.getScrapeHistory()}
    `,
  });

  return result.object;
};
