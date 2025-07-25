import { type StreamTextResult, type Message, streamText } from "ai";
import { SystemContext } from "./system-context";
import { getNextAction, type Action } from "./get-next-action";
import { queryRewriter, type QueryRewriterResult } from "./query-rewriter";
import { answerQuestion } from "./answer-question";
import { searchSerper } from "./serper";
import { bulkCrawlWebsites } from "./scraper";
import { summarizeURL } from "./summarize-url";
import { env } from "./env";
import type { LocationHints } from "./types";
import { recordError } from "./server/db/queries";

export type OurMessageAnnotation = {
  type: "NEW_ACTION";
  action: Action;
  queryPlan?: QueryRewriterResult;
};

// Copy of the search function from deep-search.ts
const searchWeb = async (query: string) => {
  const results = await searchSerper(
    { q: query, num: env.SEARCH_RESULTS_COUNT },
    undefined, // abortSignal
  );

  const mappedResults: Array<{
    title: string;
    link: string;
    snippet: string;
    date?: string;
  }> = results.organic.map((result) => ({
    title: result.title,
    link: result.link,
    snippet: result.snippet,
    date: result.date,
  }));

  return mappedResults;
};

// Copy of the scrape function from deep-search.ts
const scrapeUrl = async (urls: string[]) => {
  const results = await bulkCrawlWebsites({ urls });

  if (!results.success) {
    // Return an array with error information
    return results.results.map((r) => ({
      url: r.url,
      success: false,
      error: r.result.success ? "" : r.result.error,
      data: r.result.success ? r.result.data : "",
    }));
  }

  // Return an array of successful results
  return results.results.map((r) => ({
    url: r.url,
    success: true,
    data: r.result.data,
    date: r.result.date,
    error: "",
  }));
};

export interface RunAgentLoopArgs {
  messages: Message[];
  writeMessageAnnotation: (annotation: OurMessageAnnotation) => void;
  onFinish?: Parameters<typeof streamText>[0]["onFinish"];
  langfuseTraceId?: string;
  locationHints?: LocationHints;
  chatId?: string;
  userId?: string;
}

export const runAgentLoop = async ({
  messages,
  writeMessageAnnotation,
  onFinish,
  langfuseTraceId,
  locationHints,
  chatId,
  userId,
}: RunAgentLoopArgs): Promise<StreamTextResult<{}, string>> => {
  // A persistent container for the state of our system
  const ctx = new SystemContext(messages, locationHints);

  // A loop that continues until we have an answer
  // or we've taken 10 actions
  while (!ctx.shouldStop()) {
    // First, determine if we should continue searching or answer
    const nextAction = await getNextAction(ctx, langfuseTraceId);

    // Send annotation about the action that was chosen
    writeMessageAnnotation({
      type: "NEW_ACTION",
      action: nextAction as Action,
    } satisfies OurMessageAnnotation);

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

    // If we should continue, generate queries and search
    if (nextAction.type === "continue") {
      // Generate queries using the query rewriter
      const queryPlan = await queryRewriter(ctx, langfuseTraceId);

      // Send annotation with the query plan
      writeMessageAnnotation({
        type: "NEW_ACTION",
        action: nextAction as Action,
        queryPlan,
      } satisfies OurMessageAnnotation);

      // Execute all queries in parallel for maximum speed
      const searchPromises = queryPlan.queries.map(async (query) => {
        // Fetch search results
        const searchResults = await searchWeb(query);
        // Scrape each URL
        const urls = searchResults.map((result) => result.link);
        const scrapeResults = await scrapeUrl(urls);

        // Get conversation history for summarization context
        const conversationHistory = ctx.getConversationHistory();

        // Summarize each successful scrape result in parallel
        const summaryPromises = searchResults.map(async (result) => {
          const scrape = scrapeResults.find((s) => s.url === result.link);

          if (scrape && scrape.success) {
            try {
              const summary = await summarizeURL({
                conversationHistory,
                scrapedContent: scrape.data,
                searchMetadata: {
                  date: result.date || "Unknown",
                  title: result.title,
                  url: result.link,
                  snippet: result.snippet,
                },
                query: query,
                langfuseTraceId,
              });
              return summary;
            } catch (error) {
              console.error("Summarization failed for", result.link, error);
              return scrape.data; // Fallback to original content
            }
          } else {
            return scrape ? `Error: ${scrape.error}` : "No scrape result";
          }
        });

        const summaries = await Promise.all(summaryPromises);

        // Combine search and summarized results
        const combinedResults = searchResults.map((result, index) => ({
          date: result.date || "Unknown",
          title: result.title,
          url: result.link,
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

      // Report all search results to the context
      searchResults.forEach(({ query, results }) => {
        ctx.reportSearch({
          query,
          results,
        });
      });
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
