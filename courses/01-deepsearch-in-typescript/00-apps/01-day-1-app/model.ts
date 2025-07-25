import { google } from "@ai-sdk/google";

// Base model without search grounding
export const model = google("gemini-2.0-flash-001");

// Model with search grounding enabled
export const modelWithSearchGrounding = google("gemini-2.0-flash-001", {
  useSearchGrounding: true,
});

// Model for factuality evaluation (LLM-as-a-judge)
export const factualityModel = google("gemini-1.5-flash");

// Fast model for URL summarization with large context window
export const summaryModel = google("gemini-2.0-flash-lite");
