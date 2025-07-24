import type { Message } from "ai";
import { createDataStreamResponse, appendResponseMessages } from "ai";
import { auth } from "~/server/auth";
import {
  checkRateLimit as checkUserRateLimit,
  recordRequest,
  isUserAdmin,
  upsertChat,
} from "~/server/db/queries";
import { Langfuse } from "langfuse";
import { env } from "~/env";
import { streamFromDeepSearch } from "~/deep-search";
import { checkRateLimit, recordRateLimit } from "~/server/rate-limit";
import type { OurMessageAnnotation } from "~/run-agent-loop";
import { generateChatTitle } from "~/generate-chat-title";

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

    const rateLimitCheck = await checkUserRateLimit(userId);

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

  // Set up title generation for new chats
  let titlePromise: Promise<string> | undefined;

  if (isNewChat) {
    titlePromise = generateChatTitle(messages);
  } else {
    titlePromise = Promise.resolve("");
  }

  // Database call: Create or update the chat immediately with the current messages
  // This ensures we save the user's message even if the stream fails
  const initialUpsertSpan = trace.span({
    name: "upsert-chat-initial",
    input: {
      userId,
      chatId,
      title: "Generating...",
      messageCount: messages.length,
    },
  });

  await upsertChat({
    userId,
    chatId,
    title: "Generating...",
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
      // Collect annotations for the current message
      const annotations: OurMessageAnnotation[] = [];

      // Send new chat ID if this is a new chat
      if (isNewChat) {
        dataStream.writeData({
          type: "NEW_CHAT_CREATED",
          chatId,
        });
      }

      // Global rate limiting for LLM calls
      const globalRateLimitConfig = {
        maxRequests: 50, // For testing: only 1 request
        windowMs: 60_000, // per 2 seconds
        keyPrefix: "global_llm",
        maxRetries: 3,
      };

      // Check the global rate limit
      const globalRateLimitCheck = await checkRateLimit(globalRateLimitConfig);

      if (!globalRateLimitCheck.allowed) {
        console.log("Global rate limit exceeded, waiting...");
        const isAllowed = await globalRateLimitCheck.retry();

        // If the rate limit is still exceeded after retries, throw an error
        if (!isAllowed) {
          throw new Error("Global rate limit exceeded");
        }
      }

      // Record the global rate limit
      await recordRateLimit({
        windowMs: globalRateLimitConfig.windowMs,
        keyPrefix: globalRateLimitConfig.keyPrefix,
      });

      const result = await streamFromDeepSearch({
        messages,
        useSearchGrounding,
        telemetry: {
          isEnabled: true,
          functionId: useSearchGrounding ? `grounded-agent` : `hero-agent`,
          metadata: {
            langfuseTraceId: trace.id,
          },
        },
        writeMessageAnnotation: (annotation) => {
          // Save the annotation in-memory
          annotations.push(annotation);
          // Send it to the client
          dataStream.writeMessageAnnotation(annotation as any);
        },
        onFinish: async ({ response }) => {
          const responseMessages = response.messages;

          const updatedMessages = appendResponseMessages({
            messages,
            responseMessages,
          });

          // Add annotations to the last message (the AI response)
          const lastMessage = updatedMessages[updatedMessages.length - 1];
          if (lastMessage && annotations.length > 0) {
            lastMessage.annotations = annotations as any;
          }

          // Resolve the title promise if it exists
          const title = titlePromise ? await titlePromise : undefined;

          // Database call: Save the updated messages to the database
          const finalUpsertSpan = trace.span({
            name: "upsert-chat-final",
            input: {
              userId,
              chatId,
              title: title || "Chat",
              messageCount: updatedMessages.length,
            },
          });

          await upsertChat({
            userId,
            chatId,
            ...(title ? { title } : {}), // Only save the title if it's not empty
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
        // For external tool mode, the agent loop already writes to the data stream
        // so we just need to merge the final result
        result.mergeIntoDataStream(dataStream);
      }
    },
    onError: (e) => {
      console.error(e);
      return "Oops, an error occured!";
    },
  });
}
