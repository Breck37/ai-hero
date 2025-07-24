import { type StreamTextResult, streamText } from "ai";
import { SystemContext } from "./system-context";
import { getNextAction, type Action } from "./get-next-action";
import { answerQuestion } from "./answer-question";
import { searchSerper } from "./serper";
import { bulkCrawlWebsites } from "./scraper";
import { env } from "./env";

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

export const runAgentLoop = async (
  userQuestion: string,
  onFinish?: Parameters<typeof streamText>[0]["onFinish"],
  writeMessageAnnotation?: (annotation: OurMessageAnnotation) => void,
  langfuseTraceId?: string,
): Promise<StreamTextResult<{}, string>> => {
  // A persistent container for the state of our system
  const ctx = new SystemContext(userQuestion);

  // A loop that continues until we have an answer
  // or we've taken 10 actions
  while (!ctx.shouldStop()) {
    // We choose the next action based on the state of our system
    const nextAction = await getNextAction(ctx, langfuseTraceId);

    // Send annotation about the action that was chosen
    if (writeMessageAnnotation) {
      writeMessageAnnotation({
        type: "NEW_ACTION",
        action: nextAction as Action,
      } satisfies OurMessageAnnotation);
    }

    // We execute the action and update the state of our system
    if (nextAction.type === "search") {
      if (!nextAction.query) {
        throw new Error("Search action requires a query");
      }

      const searchResults = await searchWeb(nextAction.query);

      // Convert search results to the format expected by SystemContext
      const queryResult = {
        query: nextAction.query,
        results: searchResults.map((result) => ({
          date: result.date || "Unknown",
          title: result.title,
          url: result.link,
          snippet: result.snippet,
        })),
      };

      ctx.reportQueries([queryResult]);
    } else if (nextAction.type === "scrape") {
      if (!nextAction.urls || nextAction.urls.length === 0) {
        throw new Error("Scrape action requires URLs");
      }

      const scrapeResults = await scrapeUrl(nextAction.urls);

      // Convert scrape results to the format expected by SystemContext
      const scrapeResult = scrapeResults.map((result) => ({
        url: result.url,
        result: result.success ? result.data : `Error: ${result.error}`,
      }));

      ctx.reportScrapes(scrapeResult);
    } else if (nextAction.type === "answer") {
      return answerQuestion(ctx, { onFinish, langfuseTraceId });
    }

    // We increment the step counter
    ctx.incrementStep();
  }

  // If we've taken 10 actions and still don't have an answer,
  // we ask the LLM to give its best attempt at an answer
  return answerQuestion(ctx, { isFinal: true, onFinish, langfuseTraceId });
};
