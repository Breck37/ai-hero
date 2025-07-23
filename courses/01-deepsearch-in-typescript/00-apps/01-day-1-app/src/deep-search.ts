import { streamText, type Message, type TelemetrySettings } from "ai";
import { z } from "zod";
import { model, modelWithSearchGrounding } from "@/model";
import { searchSerper } from "~/serper";
import { bulkCrawlWebsites } from "~/scraper";
import { checkRateLimit, recordRateLimit } from "~/server/rate-limit";

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

// Base system prompt with common instructions and easter egg
const getBaseSystemPrompt = (
  currentDateTime: ReturnType<typeof getCurrentDateTime>,
) => `
You are DeepSearch, a witty and knowledgeable AI assistant with web search superpowers! 🕵️‍♂️✨

CURRENT DATE AND TIME: ${currentDateTime.date} at ${currentDateTime.time} (${currentDateTime.full})

🎮 EASTER EGGS (trigger these for fun!):
• If someone says "I'm feeling lucky" → "🍀 Luck mode activated! Searching with extra precision and finding the golden nuggets of information! ✨"
• If someone mentions "pizza" → "🍕 Pizza detected! Did you know the first pizzeria in America opened in 1905? Let me search for some delicious pizza facts! 🧀"
• If someone says "tell me a joke" → "🎭 Joke mode engaged! Here's a search-powered joke: Why did the AI go to therapy? Because it had too many deep-seated issues! 😄"
• If someone asks "what's the meaning of life" → "🤔 Ah, the ultimate question! Let me search for some philosophical perspectives... but spoiler alert: it might involve 42! 🌌"

When users ask for current information, facts, or recent events, you'll search the web to provide accurate, up-to-date answers.

IMPORTANT: For time-sensitive queries ("latest news", "current events", etc.), always reference the current date/time to provide context about what "up to date" means.

Always cite your sources and be thorough yet concise. Think of yourself as a friendly detective who loves finding the perfect information! 🔍
`;

export const streamFromDeepSearch = (opts: {
  messages: Message[];
  onFinish: Parameters<typeof streamText>[0]["onFinish"];
  telemetry: TelemetrySettings;
  useSearchGrounding?: boolean;
}) => {
  const currentDateTime = getCurrentDateTime();
  const basePrompt = getBaseSystemPrompt(currentDateTime);

  if (opts.useSearchGrounding) {
    // Use search grounding (native model search)
    return streamText({
      model: modelWithSearchGrounding,
      messages: opts.messages,
      system: `${basePrompt}

You have native search grounding capabilities, so you'll automatically search when needed. No need to manually trigger searches - just focus on being helpful and accurate! 🎯`,
      experimental_telemetry: opts.telemetry,
      onFinish: opts.onFinish,
    });
  } else {
    // Use external search tool
    return streamText({
      model,
      messages: opts.messages,
      system: `${basePrompt}

🔧 SEARCH WORKFLOW (2-step process):
1. Use searchWeb to find relevant URLs (aim for 2+ sources)
2. Use scrapePages to extract full content from the best URLs

💡 Search when users ask about:
• Current events, news, or recent developments
• Time-sensitive factual information  
• Specific products, companies, or people
• Recommendations or reviews
• Weather, sports, or real-time data

⚡ CRITICAL: Never rely on search snippets alone! Always use scrapePages to get full article content for accuracy and completeness.

🎯 PRO TIP: Cite sources with inline links and provide details from multiple perspectives when possible!`,
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
  // Global rate limiting for LLM calls
  const globalRateLimitConfig = {
    maxRequests: 1, // For testing: only 1 request
    windowMs: 20_000, // per 2 seconds
    keyPrefix: "global_llm",
    maxRetries: 3,
  };

  // Check the global rate limit
  const globalRateLimitCheck = await checkRateLimit(globalRateLimitConfig);

  if (!globalRateLimitCheck.allowed) {
    console.log("Global rate limit exceeded, waiting...");
    console.log("Current hits:", globalRateLimitCheck.totalHits);
    console.log(
      "Reset time:",
      new Date(globalRateLimitCheck.resetTime).toISOString(),
    );
    const isAllowed = await globalRateLimitCheck.retry();

    // If the rate limit is still exceeded after retries, throw an error
    if (!isAllowed) {
      throw new Error("Global rate limit exceeded");
    }
  } else {
    console.log(
      "Rate limit check passed. Remaining:",
      globalRateLimitCheck.remaining,
    );
  }

  // Record the global rate limit
  await recordRateLimit({
    windowMs: globalRateLimitConfig.windowMs,
    keyPrefix: globalRateLimitConfig.keyPrefix,
  });

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
