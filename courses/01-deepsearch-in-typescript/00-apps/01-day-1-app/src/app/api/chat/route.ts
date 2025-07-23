import type { Message } from "ai";
import { createDataStreamResponse, appendResponseMessages } from "ai";
import { auth } from "~/server/auth";
import {
  checkRateLimit,
  recordRequest,
  isUserAdmin,
  upsertChat,
} from "~/server/db/queries";
import { Langfuse } from "langfuse";
import { env } from "~/env";
import { streamFromDeepSearch } from "~/deep-search";

export const maxDuration = 60;

export async function POST(request: Request) {
  // Initialize Langfuse client
  const langfuse = new Langfuse({
    environment: env.NODE_ENV,
  });

  // Create a trace for this chat session (we'll update sessionId later)
  const trace = langfuse.trace({
    name: "chat",
    userId: "unknown", // We'll update this after auth
  });

  // Database call: Authentication
  const authSpan = trace.span({
    name: "auth-check",
    input: { requestMethod: "POST" },
  });

  const session = await auth();

  authSpan.end({
    output: {
      authenticated: !!session?.user,
      userId: session?.user?.id || null,
    },
  });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  // Update trace with actual userId
  trace.update({
    userId: session.user.id,
  });

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

  // Database call: Check if user is admin
  const adminCheckSpan = trace.span({
    name: "admin-check",
    input: { userId },
  });

  const isAdmin = await isUserAdmin(userId);

  adminCheckSpan.end({
    output: { isAdmin },
  });

  if (!isAdmin) {
    // Database call: Check rate limit for non-admin users
    const rateLimitSpan = trace.span({
      name: "rate-limit-check",
      input: { userId },
    });

    const rateLimitCheck = await checkRateLimit(userId);

    rateLimitSpan.end({
      output: {
        allowed: rateLimitCheck.allowed,
        currentCount: rateLimitCheck.currentCount,
        limit: rateLimitCheck.limit,
      },
    });

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

  // Database call: Record the request before processing
  const recordRequestSpan = trace.span({
    name: "record-request",
    input: { userId, requestType: "chat", useSearchGrounding },
  });

  await recordRequest(userId, "chat", useSearchGrounding);

  recordRequestSpan.end({
    output: { success: true },
  });

  // Generate a title from the first user message
  const firstUserMessage = messages.find((msg) => msg.role === "user");
  const title = firstUserMessage?.content
    ? firstUserMessage.content.slice(0, 50) +
      (firstUserMessage.content.length > 50 ? "..." : "")
    : "New Chat";

  // Database call: Create or update the chat immediately with the current messages
  // This ensures we save the user's message even if the stream fails
  const initialUpsertSpan = trace.span({
    name: "upsert-chat-initial",
    input: { userId, chatId, title, messageCount: messages.length },
  });

  await upsertChat({
    userId,
    chatId,
    title,
    messages,
  });

  initialUpsertSpan.end({
    output: { success: true },
  });

  // Update trace with actual sessionId now that we have the chatId
  trace.update({
    sessionId: chatId,
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

      const result = streamFromDeepSearch({
        messages,
        useSearchGrounding,
        telemetry: {
          isEnabled: true,
          functionId: useSearchGrounding ? `grounded-agent` : `hero-agent`,
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

          // Database call: Save the updated messages to the database
          const finalUpsertSpan = trace.span({
            name: "upsert-chat-final",
            input: {
              userId,
              chatId,
              title,
              messageCount: updatedMessages.length,
            },
          });

          await upsertChat({
            userId,
            chatId,
            title,
            messages: updatedMessages,
          });

          finalUpsertSpan.end({
            output: { success: true },
          });

          // Flush the trace to Langfuse
          await langfuse.flushAsync();
        },
      });

      if (useSearchGrounding) {
        result.mergeIntoDataStream(dataStream, {
          sendSources: true,
        });
      } else {
        result.mergeIntoDataStream(dataStream);
      }
    },
    onError: (e) => {
      console.error(e);
      return "Oops, an error occured!";
    },
  });
}
