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

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as {
    messages: Array<Message>;
    useSearchGrounding?: boolean;
    chatId?: string;
  };

  const { messages, useSearchGrounding = false, chatId } = body;
  const userId = session.user.id;

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

  // Generate a chat ID if none provided
  const finalChatId = chatId || crypto.randomUUID();
  const isNewChat = !chatId;

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
    chatId: finalChatId,
    title,
    messages,
  });

  return createDataStreamResponse({
    execute: async (dataStream) => {
      // Send new chat ID if this is a new chat
      if (isNewChat) {
        dataStream.writeData({
          type: "NEW_CHAT_CREATED",
          chatId: finalChatId,
        });
      }

      if (useSearchGrounding) {
        // Use search grounding (native model search)
        const result = streamText({
          model: modelWithSearchGrounding,
          messages,
          system: `You are a helpful AI assistant with access to web search capabilities through search grounding.

When users ask questions that require current information, facts, or recent events, you will automatically search the web to find relevant information.

Always try to provide accurate, up-to-date information and cite your sources when possible. Be concise but thorough in your responses.`,
          onFinish: async ({ response }) => {
            const responseMessages = response.messages;

            const updatedMessages = appendResponseMessages({
              messages,
              responseMessages,
            });

            // Save the updated messages to the database
            await upsertChat({
              userId,
              chatId: finalChatId,
              title,
              messages: updatedMessages,
            });
          },
        });

        result.mergeIntoDataStream(dataStream, {
          sendSources: true,
        });
      } else {
        // Use external search tool
        const result = streamText({
          model,
          messages,
          system: `You are a helpful AI assistant with access to web search capabilities. 

When users ask questions that require current information, facts, or recent events, you should use the searchWeb tool to find relevant information.

Critical: Always search multiple sources. Each response should provide details from at least 2 sources

Always try to search the web when:
- Users ask about current events, news, or recent developments
- Users ask for factual information that might be time-sensitive
- Users ask about specific products, companies, or people
- Users ask for recommendations or reviews
- Users ask about weather, sports scores, or other real-time data

When you use the searchWeb tool, always cite your sources with inline links in the format [source name](link). For example: "According to [TechCrunch](https://techcrunch.com/...), the latest iPhone was released..."

If you find multiple sources, cite the most relevant ones. Be concise but thorough in your responses.`,
          maxSteps: 10,
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

                const mappedResults: Array<{
                  title: string;
                  link: string;
                  snippet: string;
                }> = results.organic.map((result) => ({
                  title: result.title,
                  link: result.link,
                  snippet: result.snippet,
                }));

                return mappedResults;
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
              chatId: finalChatId,
              title,
              messages: updatedMessages,
            });
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
