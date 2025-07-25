import type { Message } from "ai";
import type { LocationHints } from "./types";

type QueryResultSearchResult = {
  date: string;
  title: string;
  url: string;
  snippet: string;
};

type QueryResult = {
  query: string;
  results: QueryResultSearchResult[];
};

type ScrapeResult = {
  url: string;
  result: string;
};

const toQueryResult = (query: QueryResultSearchResult) =>
  [`### ${query.date} - ${query.title}`, query.url, query.snippet].join("\n\n");

export class SystemContext {
  /**
   * The current step in the loop
   */
  private step = 0;

  /**
   * The full message history
   */
  private messages: Message[];

  /**
   * The history of all queries searched
   */
  private queryHistory: QueryResult[] = [];

  /**
   * The history of all URLs scraped
   */
  private scrapeHistory: ScrapeResult[] = [];

  /**
   * User location information
   */
  private locationHints?: LocationHints;

  constructor(messages: Message[], locationHints?: LocationHints) {
    this.messages = messages;
    this.locationHints = locationHints;
  }

  shouldStop() {
    return this.step >= 10;
  }

  incrementStep() {
    this.step++;
  }

  getStep() {
    return this.step;
  }

  getUserQuestion() {
    // Get the last user message
    const lastUserMessage = this.messages
      .slice()
      .reverse()
      .find((msg) => msg.role === "user");
    return lastUserMessage?.content || "";
  }

  getConversationHistory(): string {
    // Format the conversation history for the LLM
    return this.messages
      .map((msg) => {
        const role = msg.role === "user" ? "User" : "Assistant";
        return `${role}: ${msg.content}`;
      })
      .join("\n\n");
  }

  hasSearchResults() {
    return this.queryHistory.length > 0;
  }

  hasScrapedContent() {
    return this.scrapeHistory.length > 0;
  }

  reportQueries(queries: QueryResult[]) {
    this.queryHistory.push(...queries);
  }

  reportScrapes(scrapes: ScrapeResult[]) {
    this.scrapeHistory.push(...scrapes);
  }

  getQueryHistory(): string {
    return this.queryHistory
      .map((query) =>
        [
          `## Query: "${query.query}"`,
          ...query.results.map(toQueryResult),
        ].join("\n\n"),
      )
      .join("\n\n");
  }

  getScrapeHistory(): string {
    return this.scrapeHistory
      .map((scrape) =>
        [
          `## Scrape: "${scrape.url}"`,
          `<scrape_result>`,
          scrape.result,
          `</scrape_result>`,
        ].join("\n\n"),
      )
      .join("\n\n");
  }

  getLocationHints(): LocationHints | undefined {
    return this.locationHints;
  }

  getLocationPrompt(): string {
    if (!this.locationHints) {
      return "";
    }

    return `USER LOCATION:
- City: ${this.locationHints.city || "Unknown"}
- Country: ${this.locationHints.country || "Unknown"}
- Coordinates: ${this.locationHints.latitude || "Unknown"}, ${this.locationHints.longitude || "Unknown"}

When users ask for location-based information (restaurants, weather, local events, etc.), use their location to provide relevant results.`;
  }
}
