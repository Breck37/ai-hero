import type { Message, TelemetrySettings } from "ai";
import { streamText } from "ai";
import { model } from "@/model";
import { searchSerper } from "~/serper";
import { z } from "zod";
import { bulkCrawlWebsites } from "~/scraper";

export const streamFromDeepSearch = (opts: {
  messages: Message[];
  onFinish: Parameters<typeof streamText>[0]["onFinish"];
  telemetry: TelemetrySettings;
}) =>
  streamText({
    model,
    messages: opts.messages,
    maxSteps: 20,
    system: `CURRENT DATE AND TIME: ${new Date().toISOString()}

CRITICAL: You MUST use BOTH searchWeb AND scrapePages tools for EVERY question. Never skip the scraping step.

You are an AI assistant with access to web search and web scraping tools. 

DATE AWARENESS:
- The current date and time is provided above
- When users ask for "up to date", "latest", "current", "recent", or "today" information, use this date to determine what constitutes recent information
- Search results include publication dates when available - use these to prioritize the most recent and relevant content
- When citing sources, mention publication dates when available to help users understand the timeliness of information

MANDATORY WORKFLOW - YOU MUST FOLLOW THIS EXACTLY:
1. FIRST: Use the searchWeb tool to find relevant URLs for the user's question
2. SECOND: Extract the 'link' URLs from the search results (you will see them in the response)
3. THIRD: You MUST use the scrapePages tool with those extracted URLs to get full content
4. FOURTH: Analyze the scraped content to provide detailed, comprehensive answers
5. FIFTH: Always cite your sources with inline markdown links using descriptive titles and source URLs

CRITICAL RULE: You are FORBIDDEN from providing answers based only on search snippets. You MUST ALWAYS scrape the full content of relevant pages. Search snippets are insufficient for providing accurate answers.

TOOL USAGE INSTRUCTIONS:
- After using searchWeb, you will receive search results with 'link' fields and 'date' fields when available
- You MUST extract these 'link' URLs and pass them to the scrapePages tool
- Do NOT try to answer the question until you have scraped the full content
- The scrapePages tool will give you the complete article text, not just snippets
- When creating markdown links, use descriptive titles from the scraped content, not raw URLs

MANDATORY: After every searchWeb call, you MUST immediately call scrapePages with the URLs from the search results. This is not optional.

URL Selection Strategy:
- Prioritize URLs that appear most relevant to the user's specific question
- ALWAYS scrape 4-6 URLs for comprehensive coverage
- Ensure diversity in sources - include different websites, perspectives, and content types
- Avoid scraping multiple pages from the same domain unless absolutely necessary
- Include a mix of different sources for balanced perspective (news sites, blogs, official documentation, etc.)
- For simple factual questions, still use 4-6 sources to ensure accuracy
- For complex analysis, use the full 4-6 diverse sources for thorough coverage

Response Quality Guidelines:
- Structure your responses with clear sections and bullet points when appropriate
- Include specific quotes or data from the scraped content to support your points
- If information is conflicting between sources, acknowledge and explain the differences
- Be specific and detailed in your responses
- Always include source citations with proper markdown formatting
- When discussing time-sensitive information, mention publication dates and how recent the information is
- Use descriptive, readable link titles in markdown citations - NOT raw URLs
- Example: Use [TypeScript 5.4 Release Notes](https://example.com) instead of [https://example.com](https://example.com)
- Extract meaningful titles from the source content or create descriptive titles based on the content

Error Handling:
- If scraping fails for some URLs, work with the available content
- If no relevant URLs are found, ask the user to rephrase their question
- Always mention when you're working with limited information

Tone and Style:
- Be conversational but professional
- Use clear, accessible language
- Provide actionable insights when possible

REMEMBER: You MUST use both searchWeb AND scrapePages tools for every question. Never skip the scraping step.

EXAMPLE WORKFLOW:
User asks: "What are the latest developments in AI?"
1. Use searchWeb with query: "latest developments in AI 2024"
2. Look at the search results and extract the 'link' field from each result
3. Use scrapePages with those extracted links (e.g., ["https://example1.com", "https://example2.com"])
4. Analyze the scraped content and provide comprehensive answer with citations

IMPORTANT: The searchWeb tool returns results with 'link' fields. You MUST extract these links and pass them to scrapePages.`,
    tools: {
      searchWeb: {
        parameters: z.object({
          query: z.string().describe("The query to search the web for"),
        }),
        execute: async ({ query }, { abortSignal }) => {
          const results = await searchSerper(
            { q: query, num: 10 },
            abortSignal,
          );
          function getSiteName(title: string, url: string): string {
            const match = title.match(/[-|] ?([A-Za-z0-9 .&'']+)$/);
            if (match && match[1]) {
              return match[1].trim();
            }
            try {
              const { hostname } = new URL(url);
              let name =
                (hostname || "").replace(/^www\./, "").split(".")[0] ||
                "Source";
              return (
                (name || "Source")
                  .split(/[-_]/)
                  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                  .join(" ") || "Source"
              );
            } catch {
              return "Source";
            }
          }
          const mappedResults = results.organic.map((result) => ({
            title: result.title,
            link: result.link,
            snippet: result.snippet,
            source: getSiteName(result.title, result.link),
            siteName: getSiteName(result.title, result.link),
            date: result.date,
          }));
          return mappedResults;
        },
      },
      scrapePages: {
        parameters: z.object({
          urls: z
            .array(z.string())
            .describe(
              "Array of URLs to scrape and extract full content from. This tool provides the complete article content, not just snippets. Pass the URLs exactly as they appear in the 'link' field from search results. Example: ['https://example.com/article1', 'https://example.com/article2']",
            ),
        }),
        execute: async ({ urls }, { abortSignal: _abortSignal }) => {
          const result = await bulkCrawlWebsites({ urls });

          if (!result.success) {
            return {
              error: result.error,
              results: result.results.map((r) => ({
                url: r.url,
                success: r.result.success,
                data: r.result.success ? r.result.data : r.result.error,
              })),
            };
          }

          return {
            success: true,
            results: result.results.map((r) => ({
              url: r.url,
              data: r.result.data,
            })),
          };
        },
      },
    },
    onFinish: opts.onFinish,
    experimental_telemetry: opts.telemetry,
  });

export async function askDeepSearch(messages: Message[]) {
  const result = streamFromDeepSearch({
    messages,
    onFinish: () => {}, // just a stub
    telemetry: {
      isEnabled: false,
    },
  });

  // Consume the stream - without this,
  // the stream will never finish
  await result.consumeStream();

  return await result.text;
}
