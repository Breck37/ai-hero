import { type StreamTextResult, type Message, streamText } from "ai";
import { SystemContext } from "./system-context";
import { getNextAction } from "./get-next-action";
import { queryRewriter } from "./query-rewriter";
import { answerQuestion } from "./answer-question";
import { searchAndScrapeWithTavily } from "./tavily";
import { searchSerper } from "./manual-search";
import { bulkCrawlWebsites } from "./manual-scraper";
import { summarizeURL } from "./summarize-url";
import { env } from "./env";
import { getFaviconUrl } from "./utils";
import { recordError } from "./server/db/queries";
import { shouldSkipWebSearch } from "./simple-query-check";
import type { LocationHints, OurMessageAnnotation } from "./types";

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
      try {
        // Use Tavily for combined search and scrape
        const results = await searchAndScrapeWithTavily(
          query,
          env.SEARCH_RESULTS_COUNT,
          undefined,
        );
        return results.results;
      } catch (error) {
        // Check if it's a Tavily usage limit error
        if (
          error instanceof Error &&
          error.message === "TAVILY_USAGE_LIMIT_EXCEEDED"
        ) {
          console.warn(
            "Tavily usage limit exceeded, falling back to manual search",
          );

          // Send annotation about the fallback
          writeMessageAnnotation({
            type: "NEW_ACTION",
            action: {
              type: "continue",
              title: "Tavily usage limit reached - using manual search",
              reasoning:
                "Tavily API usage limit has been exceeded. Automatically falling back to manual search and scrape method.",
              feedback: "Switched to manual search due to API limits",
            },
            queryPlan: {
              plan: "Fallback to manual search due to Tavily usage limits",
              queries: [query],
            },
          } satisfies OurMessageAnnotation);

          // Fall back to manual search
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
              snippet:
                mappedResults.find((m) => m.link === r.url)?.snippet || "",
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
        throw error; // Re-throw other errors
      }
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

    // 2. Check if the query is simple enough to skip web search
    const userQuestion = ctx.getUserQuestion();
    const locationContext = ctx.getLocationPrompt();
    const simplicityCheck = await shouldSkipWebSearch(
      userQuestion,
      locationContext,
    );

    if (simplicityCheck.skip) {
      // Send annotation about skipping search
      writeMessageAnnotation({
        type: "NEW_ACTION",
        action: {
          type: "answer",
          title: "Direct response to simple query",
          reasoning: `Query identified as simple: ${simplicityCheck.reason}. Skipping web search and providing direct response.`,
          feedback: "Query identified as simple - no web search needed",
        },
        queryPlan,
      } satisfies OurMessageAnnotation);

      // Go directly to answering without search
      return answerQuestion(ctx, { onFinish, langfuseTraceId });
    }

    // 3. Search and scrape based on the queries
    const searchPromises = queryPlan.queries.map(async (query) => {
      // Fetch search results with scraped content
      const searchResults = await searchAndScrapeWeb(query);
      return { query, searchResults };
    });

    // Wait for all searches to complete
    const allSearchResults = await Promise.all(searchPromises);

    // 3. Deduplicate results and send sources annotation
    const allResults = allSearchResults.flatMap(
      ({ searchResults }) => searchResults,
    );

    // Deduplicate by URL
    const uniqueResults = allResults.filter(
      (result, index, self) =>
        index === self.findIndex((r) => r.url === result.url),
    );

    // Send one SEARCH_SOURCES annotation for all unique sources
    writeMessageAnnotation({
      type: "SEARCH_SOURCES",
      query: `Search step ${ctx.getStep() + 1}`,
      sources: uniqueResults.map((result) => ({
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        favicon: getFaviconUrl(result.url),
        date: result.date,
      })),
    } satisfies OurMessageAnnotation);

    // 4. Process results for summarization and context
    const processedResults = await Promise.all(
      allSearchResults.map(async ({ query, searchResults }) => {
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
      }),
    );

    // 5. Save processed results to the context
    processedResults.forEach(({ query, results }) => {
      ctx.reportSearch({
        query,
        results,
      });
    });

    // 4. Decide whether to continue by calling getNextAction
    const nextAction = await getNextAction(ctx, langfuseTraceId);

    // Store the feedback in the system context for the next iteration
    if ("feedback" in nextAction && nextAction.feedback) {
      ctx.setLastFeedback(nextAction.feedback);
    }

    // Send annotation about the search and evaluation step
    writeMessageAnnotation({
      type: "NEW_ACTION",
      action: {
        type: nextAction.type,
        title: nextAction.title,
        reasoning: nextAction.reasoning,
        feedback: nextAction.feedback,
      },
      queryPlan,
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
