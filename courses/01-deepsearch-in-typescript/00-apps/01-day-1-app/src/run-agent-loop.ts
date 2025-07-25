import { type StreamTextResult, type Message, streamText } from "ai";
import { SystemContext } from "./system-context";
import { getNextAction, type Action } from "./get-next-action";
import { answerQuestion } from "./answer-question";
import { searchSerper } from "./serper";
import { bulkCrawlWebsites } from "./scraper";
import { env } from "./env";
import type { LocationHints } from "./types";
import { recordError } from "./server/db/queries";

export type OurMessageAnnotation = {
  type: "NEW_ACTION";
  action: Action;
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
    // We choose the next action based on the state of our system
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

    // We execute the action and update the state of our system
    if (nextAction.type === "search") {
      if (!nextAction.query) {
        throw new Error("Search action requires a query");
      }

      // Fetch search results
      const searchResults = await searchWeb(nextAction.query);
      // Scrape each URL
      const urls = searchResults.map((result) => result.link);
      const scrapeResults = await scrapeUrl(urls);

      // Combine search and scrape results
      const combinedResults = searchResults.map((result) => {
        const scrape = scrapeResults.find((s) => s.url === result.link);
        return {
          date: result.date || "Unknown",
          title: result.title,
          url: result.link,
          snippet: result.snippet,
          scrapedContent:
            scrape && scrape.success
              ? scrape.data // Store original content for UI display
              : scrape
                ? `Error: ${scrape.error}`
                : "No scrape result",
        };
      });

      ctx.reportSearch({
        query: nextAction.query,
        results: combinedResults,
      });
    } else if (nextAction.type === "answer") {
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
