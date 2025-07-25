import type { Message } from "ai";
import type { LocationHints, SearchResult } from "./types";
import { sanitizeForJson } from "./utils";

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

    if (!lastUserMessage) return "";

    // Extract text content from message
    if (lastUserMessage.content && lastUserMessage.content.trim()) {
      return lastUserMessage.content;
    } else if (lastUserMessage.parts && Array.isArray(lastUserMessage.parts)) {
      // Extract text from parts
      return lastUserMessage.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join(" ");
    }

    return "";
  }

  getConversationHistory(): string {
    // Format the conversation history for the LLM
    return this.messages
      .map((msg) => {
        const role = msg.role === "user" ? "User" : "Assistant";

        // Extract text content from message
        let messageText = "";
        if (msg.content && msg.content.trim()) {
          messageText = msg.content;
        } else if (msg.parts && Array.isArray(msg.parts)) {
          // Extract text from parts
          messageText = msg.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join(" ");
        }

        return `${role}: ${messageText}`;
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
          `## Query: "${sanitizeForJson(search.query)}"`,
          ...search.results.map((result) =>
            [
              `### ${sanitizeForJson(result.date)} - ${sanitizeForJson(result.title)}`,
              sanitizeForJson(result.url),
              sanitizeForJson(result.snippet),
              `<scrape_result>`,
              sanitizeForJson(result.scrapedContent),
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
