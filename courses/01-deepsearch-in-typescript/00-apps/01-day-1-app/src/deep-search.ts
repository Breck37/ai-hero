import { streamText, type Message, type TelemetrySettings } from "ai";
import { z } from "zod";
import { model, modelWithSearchGrounding } from "@/model";
import { searchSerper } from "~/serper";
import { bulkCrawlWebsites } from "~/scraper";

// Helper function to get current date and time
const getCurrentDateTime = () => {
  const now = new Date();
  return {
    date: now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    time: now.toLocaleTimeString("en-US", {
      timeZoneName: "short",
    }),
    full: now.toISOString(),
  };
};

export const streamFromDeepSearch = (opts: {
  messages: Message[];
  onFinish: Parameters<typeof streamText>[0]["onFinish"];
  telemetry: TelemetrySettings;
  useSearchGrounding?: boolean;
}) => {
  const currentDateTime = getCurrentDateTime();

  if (opts.useSearchGrounding) {
    // Use search grounding (native model search)
    return streamText({
      model: modelWithSearchGrounding,
      messages: opts.messages,
      system: `You are a helpful AI assistant with access to web search capabilities through search grounding.

CURRENT DATE AND TIME: ${currentDateTime.date} at ${currentDateTime.time} (${currentDateTime.full})

When users ask questions that require current information, facts, or recent events, you will automatically search the web to find relevant information.

IMPORTANT: When users ask for "up to date" information, "latest news", "current events", or similar time-sensitive queries, always reference the current date and time to provide context about what "up to date" means. Use this information to determine if search results are recent enough.

Always try to provide accurate, up-to-date information and cite your sources when possible. Be concise but thorough in your responses.`,
      experimental_telemetry: opts.telemetry,
      onFinish: opts.onFinish,
    });
  } else {
    // Use external search tool
    return streamText({
      model,
      messages: opts.messages,
      system: `You are a helpful AI assistant with access to web search capabilities. 

CURRENT DATE AND TIME: ${currentDateTime.date} at ${currentDateTime.time} (${currentDateTime.full})

When users ask questions that require current information, facts, or recent events, you should use the searchWeb tool to find relevant information.

IMPORTANT: When users ask for "up to date" information, "latest news", "current events", or similar time-sensitive queries, always reference the current date and time to provide context about what "up to date" means. Use this information to determine if search results are recent enough.

Critical: Always search multiple sources. Each response should provide details from at least 2 sources

Always try to search the web when:
- Users ask about current events, news, or recent developments
- Users ask for factual information that might be time-sensitive
- Users ask about specific products, companies, or people
- Users ask for recommendations or reviews
- Users ask about weather, sports scores, or other real-time data

IMPORTANT WORKFLOW: After using searchWeb to find relevant URLs, you MUST use the scrapePages tool to extract the full content of the most relevant pages. This is essential for providing accurate and detailed responses.

The scrapePages tool extracts the full markdown-formatted content of web pages, which you can then analyze and reference in your responses. Always cite the specific URLs you scrape from.

WORKFLOW STEPS:
1. Use searchWeb to find relevant URLs
2. Use scrapePages to extract full content from the most relevant URLs (typically 2-3 URLs)
3. Analyze the full content to provide detailed, accurate responses
4. Cite your sources with inline links

CRITICAL: Never provide responses based only on search snippets. You MUST use scrapePages to get the full content of articles before responding. This ensures accuracy and completeness.

This workflow ensures you have complete information rather than just search snippets. Always follow this two-step process for comprehensive responses.`,
      experimental_telemetry: opts.telemetry,
      maxSteps: 10,
      tools: {
        searchWeb: {
          parameters: z.object({
            query: z
              .string()
              .describe(
                "The query to search the web for. After getting results, you MUST use scrapePages to extract full content.",
              ),
          }),
          execute: async ({ query }, { abortSignal }) => {
            const results = await searchSerper(
              { q: query, num: 10 },
              abortSignal,
            );

            const mappedResults: Array<{
              title: string;
              link: string;
              snippet: string;
              date?: string;
            }> = results.organic.map((result) => ({
              title: result.title,
              link: result.link,
              snippet: result.snippet,
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
                "Array of URLs to scrape for full content. Use this AFTER searchWeb to get complete article content.",
              ),
          }),
          execute: async ({ urls }, { abortSignal }) => {
            const results = await bulkCrawlWebsites({ urls });

            if (!results.success) {
              // Return an array with error information
              return results.results.map((r) => ({
                url: r.url,
                success: false,
                error: r.result.success ? "" : r.result.error,
                data: r.result.success ? r.result.data : "",
              }));
            }

            // Return an array of successful results
            return results.results.map((r) => ({
              url: r.url,
              success: true,
              data: r.result.data,
              date: r.result.date,
              error: "",
            }));
          },
        },
      },
      onFinish: opts.onFinish,
    });
  }
};

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
