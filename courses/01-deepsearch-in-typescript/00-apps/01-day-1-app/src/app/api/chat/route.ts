import type { Message } from "ai";
import { createDataStreamResponse, appendResponseMessages } from "ai";
import { auth } from "~/server/auth";
import {
  checkRateLimit as checkUserRateLimit,
  recordRequest,
  isUserAdmin,
  upsertChat,
  recordError,
  getChat,
} from "~/server/db/queries";
import { Langfuse } from "langfuse";
import { env } from "~/env";
import { streamFromDeepSearch } from "~/deep-search";
import { checkRateLimit, recordRateLimit } from "~/server/rate-limit";
import type { OurMessageAnnotation } from "~/types";
import { generateChatTitle } from "~/generate-chat-title";
import { geolocation } from "@vercel/functions";

export const maxDuration = 60;

export async function POST(request: Request) {
  // Mock location headers for local development
  if (process.env.NODE_ENV === "development") {
    request.headers.set("x-vercel-ip-country", "US");
    request.headers.set("x-vercel-ip-country-region", "AZ");
    request.headers.set("x-vercel-ip-city", "Phoenix");
  }

  // Get user location
  const { longitude, latitude, city, country } = geolocation(request);

  const requestHints = {
    longitude,
    latitude,
    city,
    country,
  };

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
    useTavily?: boolean;
    chatId: string;
    isNewChat?: boolean;
  };

  const {
    messages,
    useSearchGrounding = false,
    useTavily = true, // Default to Tavily
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

  // Get chat settings from database for existing chats
  let chatUseSearchGrounding = useSearchGrounding;
  let chatUseTavily = useTavily;

  if (!isNewChat) {
    try {
      const existingChat = await getChat(chatId, userId);
      if (existingChat) {
        chatUseSearchGrounding =
          existingChat.useSearchGrounding ?? useSearchGrounding;
        chatUseTavily = existingChat.useTavily ?? useTavily;
      }
    } catch (error) {
      console.error("Failed to get chat settings:", error);
      // Use the provided defaults if we can't get the chat settings
    }
  }

  // Set up title generation for new chats only
  let titlePromise: Promise<string> | undefined;

  if (isNewChat) {
    titlePromise = generateChatTitle(messages);
  }
  // For existing chats, don't generate a title - keep the existing one

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
    useSearchGrounding: chatUseSearchGrounding,
    useTavily: chatUseTavily,
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

      // Save user message immediately to ensure it persists even if the stream fails
      await upsertChat({
        userId,
        chatId,
        useSearchGrounding: chatUseSearchGrounding,
        useTavily: chatUseTavily,
        messages: messages, // This includes the user's new message
      });

      let agentError: string | null = null;
      let agentResult: any = null;
      try {
        agentResult = await streamFromDeepSearch({
          messages,
          useSearchGrounding: chatUseSearchGrounding,
          useTavily: chatUseTavily,
          telemetry: {
            isEnabled: true,
            functionId: chatUseSearchGrounding
              ? `grounded-agent`
              : `hero-agent`,
            metadata: {
              langfuseTraceId: trace.id,
            },
          },
          locationHints: requestHints,
          writeMessageAnnotation: (annotation) => {
            // Save the annotation in-memory
            annotations.push(annotation);
            // Send it to the client
            dataStream.writeMessageAnnotation(annotation as any);
          },
          chatId,
          userId,
          onFinish: async ({ response }) => {
            try {
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
              let title: string | undefined;
              if (titlePromise) {
                try {
                  title = await titlePromise;
                  // Ensure the title is valid
                  if (!title || !title.trim()) {
                    title = undefined;
                  }
                } catch (error) {
                  console.error("Failed to generate chat title:", error);
                  title = undefined;
                }
              }

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
                ...(title && title.trim() ? { title: title.trim() } : {}), // Only save the title if it's not empty or whitespace
                useSearchGrounding: chatUseSearchGrounding,
                useTavily: chatUseTavily,
                messages: updatedMessages,
              });

              finalUpsertSpan.end({
                output: { success: true },
              });

              // Flush the trace to Langfuse
              await langfuse.flushAsync();
            } catch (error) {
              console.error("Error in onFinish callback:", error);

              // Record error to database with tracing
              try {
                await recordError({
                  chatId,
                  userId,
                  langfuseTraceId: trace.id,
                  errorType: "onfinish_callback",
                  errorMessage:
                    error instanceof Error
                      ? error.message
                      : "Unknown error in onFinish",
                  errorStack: error instanceof Error ? error.stack : undefined,
                  context: {
                    messageCount: messages.length,
                    useSearchGrounding,
                  },
                });
              } catch (recordErr) {
                console.error("Failed to record error:", recordErr);
              }

              // Try to save at least the messages we have so far
              try {
                await upsertChat({
                  userId,
                  chatId,
                  messages: messages, // Fallback to original messages
                });
              } catch (fallbackError) {
                console.error("Fallback save also failed:", fallbackError);
              }
            }
          },
        });

        // Check for error action type
        if (
          agentResult &&
          typeof agentResult === "object" &&
          "type" in agentResult &&
          agentResult.type === "error"
        ) {
          agentError =
            typeof agentResult.message === "string"
              ? agentResult.message
              : "Unknown agent error";
        }

        if (!agentError) {
          if (useSearchGrounding) {
            agentResult.mergeIntoDataStream(dataStream, {
              sendSources: true,
            });
          } else {
            // For external tool mode, the agent loop already writes to the data stream
            // so we just need to merge the final result
            agentResult.mergeIntoDataStream(dataStream);
          }
        }
      } catch (err) {
        console.error("Agent loop error:", err);
        agentError =
          err &&
          typeof err === "object" &&
          err !== null &&
          "message" in err &&
          typeof (err as any).message === "string"
            ? (err as any).message
            : "Unknown error";

        // Record error to database with tracing
        try {
          await recordError({
            chatId,
            userId,
            langfuseTraceId: trace.id,
            errorType: "agent_loop",
            errorMessage: agentError || "Unknown error",
            errorStack: err instanceof Error ? err.stack : undefined,
            context: {
              messageCount: messages.length,
              useSearchGrounding,
              annotations: annotations.length,
            },
          });
        } catch (recordErr) {
          console.error("Failed to record agent loop error:", recordErr);
        }

        // Try to save messages even on error
        try {
          await upsertChat({
            userId,
            chatId,
            messages: messages, // Save at least the user's message
          });
        } catch (saveError) {
          console.error("Failed to save messages on error:", saveError);
        }
      }

      if (agentError) {
        // Check if it's a Tavily usage limit error and provide a user-friendly message
        if (agentError.includes("TAVILY_USAGE_LIMIT_EXCEEDED")) {
          throw new Error(
            "We've temporarily hit our search service limits. I've automatically switched to manual search mode and should work normally now. Please try your question again!",
          );
        }
        // Throw error to be caught by the top-level POST handler
        throw new Error(agentError);
      }
    },
    onError: (e) => {
      console.error(e);
      return "Oops, an error occured!";
    },
  });
}
