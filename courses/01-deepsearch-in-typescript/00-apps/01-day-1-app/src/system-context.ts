import type { Message } from "ai";
import type { LocationHints, SearchResult } from "./types";

type SearchHistoryEntry = {
  query: string;
  results: SearchResult[];
};

export class SystemContext {
  /**
   * The current step in the loop
   */
  private step = 0;

  /**
   * The full message history
   */
  private messages: Message[];
  private searchHistory: SearchHistoryEntry[] = [];
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
    return this.searchHistory.length > 0;
  }

  reportSearch(search: SearchHistoryEntry) {
    this.searchHistory.push(search);
  }

  getSearchHistory(): string {
    return this.searchHistory
      .map((search) =>
        [
          `## Query: "${search.query}"`,
          ...search.results.map((result) =>
            [
              `### ${result.date} - ${result.title}`,
              result.url,
              result.snippet,
              `<scrape_result>`,
              result.scrapedContent,
              `</scrape_result>`,
            ].join("\n\n"),
          ),
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

    return `USER LOCATION:\n- City: ${this.locationHints.city || "Unknown"}\n- Country: ${this.locationHints.country || "Unknown"}\n- Coordinates: ${this.locationHints.latitude || "Unknown"}, ${this.locationHints.longitude || "Unknown"}\n\nWhen users ask for location-based information (restaurants, weather, local events, etc.), use their location to provide relevant results.`;
  }
}
