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
        },
        system: `You are an AI assistant with access to a web search tool. Always use the searchWeb tool to answer user questions, and always cite your sources with inline markdown links. Use the provided 'siteName' field as the link label (e.g., [siteName](url)). Do not answer from your own knowledge; always search the web and cite sources.`,
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
      console.error(e);
      return "Oops, an error occured!";
    },
  });
}
