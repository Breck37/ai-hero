import { generateObject } from "ai";
import { z } from "zod";
import { model } from "../model";

// Define the schema for simplicity check
const simplicityCheckSchema = z.object({
  isSimple: z
    .boolean()
    .describe(
      "Whether the query is simple enough to answer without web search",
    ),
  reason: z
    .string()
    .describe("Brief explanation of why the query is simple or complex"),
  category: z
    .enum([
      "greeting",
      "simple_question",
      "conversational",
      "opinion",
      "personal",
      "complex_question",
      "factual_search",
      "current_events",
      "technical",
      "other",
    ])
    .describe("Category of the query"),
});

export type SimplicityCheckResult = {
  isSimple: boolean;
  reason: string;
  category: string;
};

/**
 * Check if a query is simple enough to answer without web search
 */
export async function checkQuerySimplicity(
  query: string,
  locationContext?: string,
): Promise<SimplicityCheckResult> {
  const systemPrompt = `You are a query analyzer that determines whether a user's query is simple enough to answer without web search.

IMPORTANT: This AI assistant has web search capabilities and should use them for any query that requires current, factual, or location-specific information.

SIMPLE QUERIES (no web search needed):
- Greetings: "Hello", "Hi there", "Good morning", "How are you?"
- Simple conversational responses: "That's interesting", "I agree", "Thank you"
- Basic questions about the AI itself: "What can you do?", "How do you work?", "What's your name?"
- Simple opinions or preferences: "What's your favorite color?", "Do you like pizza?"
- Basic math or logic: "What's 2+2?"
- Personal questions about the AI: "How old are you?", "Where are you from?"

QUERIES THAT NEED WEB SEARCH:
- Current information: "What's the weather today?", "What's the time in Tokyo?"
- Factual questions: "What's the population of Tokyo?", "When was the iPhone invented?"
- Current events: "What happened in the news today?", "Who won the latest election?"
- Technical questions: "How does quantum computing work?", "What's the latest in AI research?"
- Location-specific queries: "What restaurants are open near me?", "What's the weather like?"
- Recent developments: "What's new in React 18?", "Latest COVID guidelines"
- Comparisons: "iPhone vs Android", "Best programming languages 2024"
- Any query requiring current, real-time, or location-specific data

LOCATION CONTEXT: ${locationContext || "No location information available"}

If the query asks for current information, weather, time, or location-specific data, it NEEDS web search regardless of how simple the question seems.`;

  const result = await generateObject({
    model,
    schema: simplicityCheckSchema,
    system: systemPrompt,
    prompt: `Query: "${query}"

Analyze this query and determine if it's simple enough to answer without web search.`,
  });

  return result.object as SimplicityCheckResult;
}

// Common patterns for quick checking
const GREETINGS = [
  "hello",
  "hi",
  "hey",
  "good morning",
  "good afternoon",
  "good evening",
  "howdy",
  "greetings",
  "salutations",
  "yo",
  "sup",
  "what's up",
  "good day",
  "good night",
  "morning",
  "afternoon",
  "evening",
];

const GREETING_PATTERNS = [
  "hello my",
  "hi my",
  "hey my",
  "hello there",
  "hi there",
  "hey there",
  "hello friend",
  "hi friend",
  "hey friend",
];

const CONVERSATIONAL = [
  "thanks",
  "thank you",
  "ok",
  "okay",
  "yes",
  "no",
  "maybe",
  "sure",
  "that's interesting",
  "i see",
  "got it",
  "understood",
  "cool",
  "nice",
  "good",
  "bad",
  "great",
  "awesome",
  "terrible",
  "wow",
  "really?",
  "seriously?",
  "haha",
  "lol",
  "omg",
  "wow",
];

const AI_QUESTIONS = [
  "what can you do",
  "how do you work",
  "what are you",
  "who are you",
  "are you ai",
  "are you real",
  "do you have feelings",
  "can you think",
  "what's your name",
  "how old are you",
  "where are you from",
];

const OPINIONS = [
  "what's your favorite",
  "do you like",
  "what do you think about",
  "what's the best",
  "what's the worst",
  "would you rather",
];

/**
 * Quick check for common simple patterns without using AI
 */
export function isSimpleQueryQuickCheck(query: string): boolean {
  const lowerQuery = query.toLowerCase().trim();

  // Check for exact matches
  if (GREETINGS.some((greeting) => lowerQuery === greeting)) {
    return true;
  }

  // Check for greeting patterns
  if (GREETING_PATTERNS.some((pattern) => lowerQuery.startsWith(pattern))) {
    return true;
  }

  // Check for conversational patterns (exact matches or very short phrases)
  if (CONVERSATIONAL.some((phrase) => lowerQuery.includes(phrase))) {
    // Only treat as simple if it's a short query or exact match
    if (
      lowerQuery.length <= 30 ||
      CONVERSATIONAL.some((phrase) => lowerQuery === phrase)
    ) {
      return true;
    }
  }

  // Check for AI questions
  if (AI_QUESTIONS.some((question) => lowerQuery.includes(question))) {
    return true;
  }

  // Check for opinion questions (but be careful not to catch complex ones)
  if (OPINIONS.some((opinion) => lowerQuery.includes(opinion))) {
    // Only return true for very simple opinion questions
    const words = lowerQuery.split(" ");
    if (words.length <= 5) {
      return true;
    }
  }

  // Check for very short queries (likely simple)
  const words = lowerQuery.split(" ");
  if (lowerQuery.length <= 20 && words.length <= 3) {
    return true;
  }

  return false;
}

/**
 * Combined approach: quick check first, then AI analysis if needed
 */
export async function shouldSkipWebSearch(
  query: string,
  locationContext?: string,
): Promise<{ skip: boolean; reason: string }> {
  // First do a quick check for obvious simple cases
  if (isSimpleQueryQuickCheck(query)) {
    // But be more careful - don't skip if it's asking for current/weather/time info
    const lowerQuery = query.toLowerCase().trim();
    const currentInfoKeywords = [
      "weather",
      "time",
      "today",
      "now",
      "current",
      "temperature",
      "forecast",
    ];
    const hasCurrentInfoRequest = currentInfoKeywords.some((keyword) =>
      lowerQuery.includes(keyword),
    );

    if (hasCurrentInfoRequest) {
      return {
        skip: false,
        reason: "Query requests current information - web search needed",
      };
    }

    return {
      skip: true,
      reason:
        "Query appears to be a simple greeting or conversational response",
    };
  }

  // Use AI analysis for more intelligent decision making
  try {
    const result = await checkQuerySimplicity(query, locationContext);
    return {
      skip: result.isSimple,
      reason: result.reason,
    };
  } catch (error) {
    console.warn(
      "AI simplicity check failed, falling back to quick check:",
      error,
    );

    // If AI analysis fails, be more conservative with the quick check
    // Only skip for very obvious simple cases
    const lowerQuery = query.toLowerCase().trim();
    const isVerySimple =
      lowerQuery.length <= 15 &&
      (GREETINGS.some((greeting) => lowerQuery === greeting) ||
        CONVERSATIONAL.some((phrase) => lowerQuery === phrase));

    return {
      skip: isVerySimple,
      reason: isVerySimple
        ? "Query appears to be a very simple greeting or response"
        : "AI analysis failed, defaulting to web search for safety",
    };
  }
}
