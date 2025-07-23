import type { Message } from "ai";
import {
  streamText,
  createDataStreamResponse,
  appendResponseMessages,
} from "ai";
import { z } from "zod";
import { model, modelWithSearchGrounding } from "@/model";
import { auth } from "~/server/auth";
import { searchSerper } from "~/serper";
import {
  checkRateLimit,
  recordRequest,
  isUserAdmin,
  upsertChat,
} from "~/server/db/queries";
import { Langfuse } from "langfuse";
import { env } from "~/env";
import { bulkCrawlWebsites } from "~/scraper";

export const maxDuration = 60;

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

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as {
    messages: Array<Message>;
    useSearchGrounding?: boolean;
    chatId: string;
    isNewChat?: boolean;
  };

  const {
    messages,
    useSearchGrounding = false,
    chatId,
    isNewChat = false,
  } = body;
  const userId = session.user.id;

  // Initialize Langfuse client
  const langfuse = new Langfuse({
    environment: env.NODE_ENV,
  });

  // Create a trace for this chat session
  const trace = langfuse.trace({
    sessionId: chatId,
    name: "chat",
    userId: session.user.id,
  });

  // Check if user is admin (admins bypass rate limits)
  const isAdmin = await isUserAdmin(userId);

  if (!isAdmin) {
    // Check rate limit for non-admin users
    const rateLimitCheck = await checkRateLimit(userId);

    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          message: `You have exceeded your daily limit of ${rateLimitCheck.limit} requests. You have made ${rateLimitCheck.currentCount} requests today.`,
          currentCount: rateLimitCheck.currentCount,
          limit: rateLimitCheck.limit,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": rateLimitCheck.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(
              Date.now() + 24 * 60 * 60 * 1000,
            ).toISOString(),
          },
        },
      );
    }
  }

  // Record the request before processing
  await recordRequest(userId, "chat", useSearchGrounding);

  // Generate a title from the first user message
  const firstUserMessage = messages.find((msg) => msg.role === "user");
  const title = firstUserMessage?.content
    ? firstUserMessage.content.slice(0, 50) +
      (firstUserMessage.content.length > 50 ? "..." : "")
    : "New Chat";

  // Create or update the chat immediately with the current messages
  // This ensures we save the user's message even if the stream fails
  await upsertChat({
    userId,
    chatId,
    title,
    messages,
  });

  return createDataStreamResponse({
    execute: async (dataStream) => {
      // Send new chat ID if this is a new chat
      if (isNewChat) {
        dataStream.writeData({
          type: "NEW_CHAT_CREATED",
          chatId,
        });
      }

      if (useSearchGrounding) {
        // Use search grounding (native model search)
        const currentDateTime = getCurrentDateTime();
        const result = streamText({
          model: modelWithSearchGrounding,
          messages,
          system: `You are a helpful AI assistant with access to web search capabilities through search grounding.

CURRENT DATE AND TIME: ${currentDateTime.date} at ${currentDateTime.time} (${currentDateTime.full})

When users ask questions that require current information, facts, or recent events, you will automatically search the web to find relevant information.

IMPORTANT: When users ask for "up to date" information, "latest news", "current events", or similar time-sensitive queries, always reference the current date and time to provide context about what "up to date" means. Use this information to determine if search results are recent enough.

Always try to provide accurate, up-to-date information and cite your sources when possible. Be concise but thorough in your responses.`,
          experimental_telemetry: {
            isEnabled: true,
            functionId: `grounded-agent`,
            metadata: {
              langfuseTraceId: trace.id,
            },
          },
          onFinish: async ({ response }) => {
            const responseMessages = response.messages;

            const updatedMessages = appendResponseMessages({
              messages,
              responseMessages,
            });

            // Save the updated messages to the database
            await upsertChat({
              userId,
              chatId,
              title,
              messages: updatedMessages,
            });

            // Flush the trace to Langfuse
            await langfuse.flushAsync();
          },
        });

        result.mergeIntoDataStream(dataStream, {
          sendSources: true,
        });
      } else {
        // Use external search tool
        const currentDateTime = getCurrentDateTime();
        const result = streamText({
          model,
          messages,
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
          experimental_telemetry: {
            isEnabled: true,
            functionId: `hero-agent`,
            metadata: {
              langfuseTraceId: trace.id,
            },
          },
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
          onFinish: async ({ response }) => {
            const responseMessages = response.messages;

            const updatedMessages = appendResponseMessages({
              messages,
              responseMessages,
            });

            // Save the updated messages to the database
            await upsertChat({
              userId,
              chatId,
              title,
              messages: updatedMessages,
            });

            // Flush the trace to Langfuse
            await langfuse.flushAsync();
          },
        });

        result.mergeIntoDataStream(dataStream);
      }
    },
    onError: (e) => {
      console.error(e);
      return "Oops, an error occured!";
    },
  });
}
