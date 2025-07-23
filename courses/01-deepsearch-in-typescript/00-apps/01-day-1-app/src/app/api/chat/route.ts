import type { Message } from "ai";
import { streamText, createDataStreamResponse } from "ai";
import { z } from "zod";
import { model, modelWithSearchGrounding } from "@/model";
import { auth } from "~/server/auth";
import { searchSerper } from "~/serper";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as {
    messages: Array<Message>;
    useSearchGrounding?: boolean;
  };

  return createDataStreamResponse({
    execute: async (dataStream) => {
      const { messages, useSearchGrounding = false } = body;

      if (useSearchGrounding) {
        // Use search grounding (native model search)
        const result = streamText({
          model: modelWithSearchGrounding,
          messages,
          system: `You are a helpful AI assistant with access to web search capabilities through search grounding.

When users ask questions that require current information, facts, or recent events, you will automatically search the web to find relevant information.

Always try to provide accurate, up-to-date information and cite your sources when possible. Be concise but thorough in your responses.`,
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
