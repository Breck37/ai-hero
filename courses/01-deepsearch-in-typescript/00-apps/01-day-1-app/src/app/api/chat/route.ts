import type { Message } from "ai";
import { createDataStreamResponse } from "ai";
import { auth } from "~/server/auth";
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
import { streamFromDeepSearch } from "~/deep-search";
import { checkRateLimit, recordRateLimit } from "~/server/redis/rate-limit";

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

  // Create Langfuse trace early - we'll update the sessionId later
  const trace = langfuse.trace({
    name: "chat",
    userId: session.user.id,
  });

  const userId = session.user.id;

  // Fetch user to check admin status
  const userSpan = trace.span({
    name: "fetch-user",
    input: { userId },
  });

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });

  userSpan.end({
    output: {
      userFound: !!user,
      isAdmin: user?.isAdmin ?? false,
    },
  });

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const isAdmin = user.isAdmin;

  // Global rate limiting for LLM calls
  const globalRateLimitConfig = {
    maxRequests: 1, // For testing: only 1 request
    windowMs: 5_000, // For testing: 5 second window
    keyPrefix: "global_llm",
    maxRetries: 3,
  };

  const globalRateLimitCheck = await checkRateLimit(globalRateLimitConfig);

  if (!globalRateLimitCheck.allowed) {
    console.log("Global rate limit exceeded, waiting...");
    const isAllowed = await globalRateLimitCheck.retry();

    if (!isAllowed) {
      return new Response("Global rate limit exceeded", {
        status: 429,
      });
    }
  }

  // Record the global rate limit
  await recordRateLimit({
    windowMs: globalRateLimitConfig.windowMs,
    keyPrefix: globalRateLimitConfig.keyPrefix,
  });

  // Use the reusable rate limit hook
  const rateLimitSpan = trace.span({
    name: "check-rate-limit",
    input: { userId, endpoint: "chat", isAdmin, maxRequestsPerDay: 100 },
  });

  const { allowed, error: rateLimitError } = await checkAndRecordRateLimit({
    db,
    userId,
    endpoint: "chat",
    isAdmin,
    maxRequestsPerDay: 100,
    trace,
  });

  rateLimitSpan.end({
    output: { allowed, error: rateLimitError },
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

    const upsertChatSpan = trace.span({
      name: "upsert-chat-initial",
      input: {
        userId,
        chatId: currentChatId,
        title: chatTitle,
        messageCount: body.messages.length,
        isNewChat: true,
      },
    });

    await upsertChat({
      userId,
      chatId: currentChatId,
      title: chatTitle,
      messages: body.messages.map((m, i) => ({
        role: m.role,
        parts: m.parts ?? [],
        order: i,
      })),
      trace,
    });

    upsertChatSpan.end({
      output: { success: true, chatId: currentChatId },
    });
  }

  // Update trace with sessionId now that we have the chatId
  trace.update({
    sessionId: currentChatId,
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

      const result = streamFromDeepSearch({
        messages,
        onFinish: async ({ response }) => {
          // Merge messages and save to DB
          const updatedMessages = appendResponseMessages({
            messages: body.messages,
            responseMessages: response.messages,
          });

          const finalUpsertSpan = trace.span({
            name: "upsert-chat-final",
            input: {
              userId,
              chatId: currentChatId,
              title: chatTitle,
              messageCount: updatedMessages.length,
              isNewChat: false,
            },
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
            trace,
          });

          finalUpsertSpan.end({
            output: { success: true, chatId: currentChatId },
          });

          // Flush the trace to Langfuse
          await langfuse.flushAsync();
        },
        telemetry: {
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
