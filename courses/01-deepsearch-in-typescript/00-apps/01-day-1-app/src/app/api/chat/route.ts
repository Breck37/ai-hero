import type { Message } from "ai";
import { streamText, createDataStreamResponse } from "ai";
import { model } from "@/model";
import { auth } from "~/server/auth";
import { searchSerper } from "~/serper";
import { z } from "zod";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as {
    messages: Array<Message>;
  };

  return createDataStreamResponse({
    execute: async (dataStream: any) => {
      const { messages } = body;
      const result = streamText({
        model,
        messages,
        system: `You are an AI assistant with access to a web search tool. Always use the searchWeb tool to answer user questions, and always cite your sources with inline markdown links. Use the provided 'siteName' field as the link label (e.g., [siteName](url)). Do not answer from your own knowledge; always search the web and cite sources.`,
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
              // Extracts a readable site name from the title or prettifies the domain as fallback
              function getSiteName(title: string, url: string): string {
                // Try to extract site name from title (e.g., "Article - Site Name" or "Article | Site Name")
                const match = title.match(/[-|] ?([A-Za-z0-9 .&'’]+)$/);
                if (match && match[1]) {
                  return match[1].trim();
                }
                // Fallback: prettify the domain
                try {
                  const { hostname } = new URL(url);
                  // Remove www., split on dots, take the first part
                  let name =
                    (hostname || "").replace(/^www\./, "").split(".")[0] ||
                    "Source";
                  // Split on dashes/underscores, capitalize each part, join with space
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
                source: getSiteName(result.title, result.link), // for backward compatibility
                siteName: getSiteName(result.title, result.link),
              }));
            },
          },
        },
        maxSteps: 10,
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: (e: unknown) => {
      console.error(e);
      return "Oops, an error occured!";
    },
  });
}
