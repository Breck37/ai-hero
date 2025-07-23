import { google } from "@ai-sdk/google";

// Base model without search grounding
export const model = google("gemini-2.0-flash-001");

// Model with search grounding enabled
export const modelWithSearchGrounding = google("gemini-2.0-flash-001", {
  useSearchGrounding: true,
});
