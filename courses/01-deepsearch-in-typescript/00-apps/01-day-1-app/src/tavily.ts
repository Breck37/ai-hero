import { tavily } from "@tavily/core";
import { cacheWithRedis } from "~/server/redis/redis";
import { env } from "~/env.js";
import { setTavilyLimitExceeded } from "./utils";

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content?: string | null;
}

export interface TavilySearchResponse {
  query: string;
  answer?: string;
  images: unknown[];
  results: TavilySearchResult[];
}

const tavilyClient = tavily({
  apiKey: env.TAVILY_API_KEY,
});

const searchWithTavily = cacheWithRedis(
  "tavily",
  async (
    query: string,
    numResults: number,
    _signal: AbortSignal | undefined,
  ): Promise<TavilySearchResponse> => {
    try {
      const response = await tavilyClient.search(query, {
        num: numResults,
        search_depth: "advanced", // This enables content scraping
        include_answer: true,
        include_images: false,
        include_raw_content: true,
      });

      return response;
    } catch (error) {
      // Check if it's a usage limit error
      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string" &&
        error.message.includes("usage limit")
      ) {
        setTavilyLimitExceeded(true);
        throw new Error("TAVILY_USAGE_LIMIT_EXCEEDED");
      }
      throw error;
    }
  },
);

export const searchAndScrapeWithTavily = async (
  query: string,
  numResults: number = env.SEARCH_RESULTS_COUNT,
  signal?: AbortSignal,
): Promise<{
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    scrapedContent: string;
    date?: string;
  }>;
}> => {
  const response = await searchWithTavily(query, numResults, signal);

  const mappedResults = response.results.map((result) => ({
    title: result.title,
    url: result.url,
    snippet: result.content.substring(0, 200) + "...", // Create a snippet from content
    scrapedContent: result.raw_content ?? result.content,
    date: undefined, // Tavily doesn't provide dates in the standard response
  }));

  return {
    query: response.query,
    results: mappedResults,
  };
};
