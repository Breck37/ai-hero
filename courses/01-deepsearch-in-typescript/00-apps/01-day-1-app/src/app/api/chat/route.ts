import type { Message } from "ai";
import { streamText, createDataStreamResponse } from "ai";
import { model } from "@/model";
import { auth } from "~/server/auth";
import { searchSerper } from "~/serper";
import { z } from "zod";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { checkAndRecordRateLimit } from "~/server/db/rate-limit";
import { experimental_createMCPClient as createMCPClient } from "ai";
import { upsertChat } from "~/server/db/queries";
import { appendResponseMessages } from "ai";
import { randomUUID } from "crypto";
import { Langfuse } from "langfuse";
import { env } from "~/env";
import { bulkCrawlWebsites } from "~/scraper";

// To run the Everything MCP Server locally:
// npx @modelcontextprotocol/server-everything sse
// This will start the server at http://localhost:3000/sse

let mcpClient: Awaited<ReturnType<typeof createMCPClient>> | null = null;
async function getMCPClient() {
  if (!mcpClient) {
    mcpClient = await createMCPClient({
      transport: {
        type: "sse",
        url: "http://localhost:3001/sse",
      },
    });
  }
  return mcpClient;
}

const langfuse = new Langfuse({
  environment: env.NODE_ENV,
});

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  // Fetch user to check admin status
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const isAdmin = user.isAdmin;

  // Use the reusable rate limit hook
  const { allowed, error: rateLimitError } = await checkAndRecordRateLimit({
    db,
    userId,
    endpoint: "chat",
    isAdmin,
    maxRequestsPerDay: 100,
  });
  if (!allowed) {
    return new Response(rateLimitError || "Too Many Requests", { status: 429 });
  }

  const body = (await request.json()) as {
    messages: Array<Message>;
    chatId: string;
    isNewChat: boolean;
    title?: string;
  };

  const { chatId, isNewChat } = body;

  // Helper to extract a chat title from the first user message's first text part
  function getChatTitle(messages: Message[]): string {
    const first = messages[0];
    if (!first || !first.parts || !Array.isArray(first.parts))
      return "New Chat";
    const textPart = first.parts.find(
      (p) =>
        p &&
        typeof p === "object" &&
        "text" in p &&
        typeof (p as any).text === "string",
    );
    return textPart && (textPart as any).text
      ? (textPart as any).text.slice(0, 40)
      : "New Chat";
  }
  const chatTitle = body.title || getChatTitle(body.messages);

  // Create or get the current chat ID for Langfuse session
  let currentChatId = chatId;
  if (isNewChat) {
    currentChatId = randomUUID();
    await upsertChat({
      userId,
      chatId: currentChatId,
      title: chatTitle,
      messages: body.messages.map((m, i) => ({
        role: m.role,
        parts: m.parts ?? [],
        order: i,
      })),
    });
  }

  // Create Langfuse trace with user and session
  const trace = langfuse.trace({
    sessionId: currentChatId,
    name: "chat",
    userId: session.user.id,
  });

  return createDataStreamResponse({
    execute: async (dataStream: any) => {
      if (isNewChat) {
        dataStream.writeData({
          type: "NEW_CHAT_CREATED",
          chatId: currentChatId,
        });
      }
      const { messages } = body;
      const mcp = await getMCPClient();
      const tools = await mcp.tools();

      const result = streamText({
        model,
        messages,
        tools: {
          ...tools,
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
                      .map(
                        (part) => part.charAt(0).toUpperCase() + part.slice(1),
                      )
                      .join(" ") || "Source"
                  );
                } catch {
                  return "Source";
                }
              }
              return results.organic.map((result) => ({
                title: result.title,
                link: result.link,
                snippet: result.snippet,
                source: getSiteName(result.title, result.link),
                siteName: getSiteName(result.title, result.link),
              }));
            },
          },
          scrapePages: {
            parameters: z.object({
              urls: z
                .array(z.string())
                .describe(
                  "Array of URLs to scrape and extract full content from",
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
        system: `You are an AI assistant with access to web search and web scraping tools. 

ALWAYS follow this workflow:
1. Use the searchWeb tool to find relevant URLs for the user's question
2. ALWAYS use the scrapePages tool to extract the full content from the most relevant URLs found in step 1
3. Analyze the scraped content to provide detailed, comprehensive answers
4. Always cite your sources with inline markdown links using the source URLs

IMPORTANT: Never rely solely on search snippets. ALWAYS scrape the full content of relevant pages to provide the most accurate and detailed answers possible.

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

Error Handling:
- If scraping fails for some URLs, work with the available content
- If no relevant URLs are found, ask the user to rephrase their question
- Always mention when you're working with limited information

Tone and Style:
- Be conversational but professional
- Use clear, accessible language
- Provide actionable insights when possible

Do not answer from your own knowledge; always search the web, scrape the content, and cite sources.`,
        maxSteps: 10,
        onFinish: async ({ response }) => {
          // Merge messages and save to DB
          const updatedMessages = appendResponseMessages({
            messages: body.messages,
            responseMessages: response.messages,
          });
          await upsertChat({
            userId,
            chatId: currentChatId,
            title: chatTitle,
            messages: updatedMessages.map((m, i) => ({
              role: m.role,
              parts: m.parts ?? [],
              order: i,
            })),
          });

          // Flush the trace to Langfuse
          await langfuse.flushAsync();
        },
        experimental_telemetry: {
          isEnabled: true,
          functionId: "Asuhhhh-dude-wizard",
          metadata: {
            langfuseTraceId: trace.id,
          },
        },
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: (e: unknown) => {
      console.error("Chat API Error:", e);

      // Provide more specific error messages based on the error type
      if (e instanceof Error) {
        if (e.message.includes("rate limit") || e.message.includes("429")) {
          return "Rate limit exceeded. Please wait a moment and try again.";
        }
        if (e.message.includes("network") || e.message.includes("fetch")) {
          return "Network error. Please check your connection and try again.";
        }
        if (e.message.includes("timeout")) {
          return "Request timed out. Please try again.";
        }
        return `An error occurred: ${e.message}`;
      }

      return "An unexpected error occurred. Please try again.";
    },
  });
}
