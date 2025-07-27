import { type StreamTextResult, type Message, streamText } from "ai";
import { SystemContext } from "./system-context";
import { getNextAction, type Action } from "./get-next-action";
import { queryRewriter, type QueryRewriterResult } from "./query-rewriter";
import { answerQuestion } from "./answer-question";
import { searchAndScrapeWithTavily } from "./tavily";
import { searchSerper } from "./manual-search";
import { bulkCrawlWebsites } from "./manual-scraper";
import { summarizeURL } from "./summarize-url";
import { env } from "./env";
import type { LocationHints } from "./types";
import { recordError } from "./server/db/queries";

export type OurMessageAnnotation = {
  type: "NEW_ACTION";
  action: Action;
  queryPlan?: QueryRewriterResult;
};

export interface RunAgentLoopArgs {
  messages: Message[];
  writeMessageAnnotation: (annotation: OurMessageAnnotation) => void;
  onFinish?: Parameters<typeof streamText>[0]["onFinish"];
  langfuseTraceId?: string;
  locationHints?: LocationHints;
  chatId?: string;
  userId?: string;
  useTavily?: boolean;
}

export const runAgentLoop = async ({
  messages,
  writeMessageAnnotation,
  onFinish,
  langfuseTraceId,
  locationHints,
  chatId,
  userId,
  useTavily = true, // Default to Tavily
}: RunAgentLoopArgs): Promise<StreamTextResult<{}, string>> => {
  // A persistent container for the state of our system
  const ctx = new SystemContext(messages, locationHints);

  // Combined search and scrape function using either Tavily or manual method
  const searchAndScrapeWeb = async (query: string) => {
    if (useTavily) {
      // Use Tavily for combined search and scrape
      const results = await searchAndScrapeWithTavily(
        query,
        env.SEARCH_RESULTS_COUNT,
        undefined,
      );
      return results.results;
    } else {
      // Use manual search and scrape (separate steps)
      const searchResults = await searchSerper(
        { q: query, num: env.SEARCH_RESULTS_COUNT },
        undefined, // abortSignal
      );

      const mappedResults: Array<{
        title: string;
        link: string;
        snippet: string;
        date?: string;
      }> = searchResults.organic.map((result) => ({
        title: result.title,
        link: result.link,
        snippet: result.snippet,
        date: result.date,
      }));

      // Scrape each URL
      const urls = mappedResults.map((result) => result.link);
      const scrapeResults = await bulkCrawlWebsites({ urls });

      if (!scrapeResults.success) {
        // Return an array with error information
        return scrapeResults.results.map((r) => ({
          title:
            mappedResults.find((m) => m.link === r.url)?.title || "Unknown",
          url: r.url,
          snippet: mappedResults.find((m) => m.link === r.url)?.snippet || "",
          scrapedContent: r.result.success
            ? r.result.data
            : `Error: ${r.result.error}`,
          date: mappedResults.find((m) => m.link === r.url)?.date,
        }));
      }

      // Return an array of successful results
      return mappedResults.map((result, index) => ({
        title: result.title,
        url: result.link,
        snippet: result.snippet,
        scrapedContent: scrapeResults.results[index]?.result.success
          ? scrapeResults.results[index]!.result.data
          : "No content available",
        date: scrapeResults.results[index]?.result.date || result.date,
      }));
    }
  };

  // A loop that continues until we have an answer
  // or we've taken 10 actions
  while (!ctx.shouldStop()) {
    // 1. Run the query rewriter
    const queryPlan = await queryRewriter(ctx, langfuseTraceId);

    // 2. Search and scrape based on the queries
    const searchPromises = queryPlan.queries.map(async (query) => {
      // Fetch search results with scraped content
      const searchResults = await searchAndScrapeWeb(query);

      // Get conversation history for summarization context
      const conversationHistory = ctx.getConversationHistory();

      // Summarize each result in parallel
      const summaryPromises = searchResults.map(async (result) => {
        try {
          const summary = await summarizeURL({
            conversationHistory,
            scrapedContent: result.scrapedContent,
            searchMetadata: {
              date: result.date || "Unknown",
              title: result.title,
              url: result.url,
              snippet: result.snippet,
            },
            query: query,
            langfuseTraceId,
          });
          return summary;
        } catch (error) {
          console.error("Summarization failed for", result.url, error);
          return result.scrapedContent; // Fallback to original content
        }
      });

      const summaries = await Promise.all(summaryPromises);

      // Combine search and summarized results
      const combinedResults = searchResults.map((result, index) => ({
        date: result.date || "Unknown",
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        scrapedContent: summaries[index] || "No content available",
      }));

      return {
        query,
        results: combinedResults,
      };
    });

    // Wait for all searches to complete
    const searchResults = await Promise.all(searchPromises);

    // 3. Save it to the context
    searchResults.forEach(({ query, results }) => {
      ctx.reportSearch({
        query,
        results,
      });
    });

    // Send annotation about the search step
    writeMessageAnnotation({
      type: "NEW_ACTION",
      action: {
        type: "continue",
        title: "Searching for information",
        reasoning: `Executed ${queryPlan.queries.length} search queries to gather information`,
      } as Action,
      queryPlan,
    } satisfies OurMessageAnnotation);

    // 4. Decide whether to continue by calling getNextAction
    const nextAction = await getNextAction(ctx, langfuseTraceId);

    // Handle error action
    if (nextAction.type === "error") {
      console.error("Agent error:", nextAction.message);

      // Record error to database if we have the required info
      if (chatId && userId) {
        try {
          await recordError({
            chatId,
            userId,
            langfuseTraceId,
            errorType: "llm_output",
            errorMessage: nextAction.message,
            context: {
              step: ctx.getStep(),
              hasSearchResults: ctx.hasSearchResults(),
              ...((nextAction as any).context || {}),
            },
          });
        } catch (recordErr) {
          console.error("Failed to record agent error:", recordErr);
        }
      }

      // Break to allow fallback logic to handle the error gracefully
      break;
    }

    // If we should answer, do so immediately
    if (nextAction.type === "answer") {
      return answerQuestion(ctx, { onFinish, langfuseTraceId });
    }

    // We increment the step counter
    ctx.incrementStep();
  }

  // If we've taken 10 actions and still don't have an answer,
  // we ask the LLM to give its best attempt at an answer
  return answerQuestion(ctx, {
    isFinal: true,
    onFinish,
    langfuseTraceId,
  });
};
