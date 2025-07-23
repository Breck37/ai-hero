import {
  streamText,
  type Message,
  type TelemetrySettings,
  type StreamTextResult,
} from "ai";
import { modelWithSearchGrounding } from "@/model";
import { checkRateLimit, recordRateLimit } from "~/server/rate-limit";
import { runAgentLoop } from "./run-agent-loop";

// Helper function to get current date and time
const getCurrentDateTime = () => {
  const now = new Date();
  return {
    date: now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    time: now.toLocaleTimeString("en-US", {
      timeZoneName: "short",
    }),
    full: now.toISOString(),
  };
};

// Base system prompt with common instructions and easter egg
const getBaseSystemPrompt = (
  currentDateTime: ReturnType<typeof getCurrentDateTime>,
) => `
You are DeepSearch, a witty and knowledgeable AI assistant with web search superpowers! 🕵️‍♂️✨

CURRENT DATE AND TIME: ${currentDateTime.date} at ${currentDateTime.time} (${currentDateTime.full})

🎮 EASTER EGGS (trigger these for fun!):
• If someone says "I'm feeling lucky" → "🍀 Luck mode activated! Searching with extra precision and finding the golden nuggets of information! ✨"
• If someone mentions "pizza" → "🍕 Pizza detected! Did you know the first pizzeria in America opened in 1905? Let me search for some delicious pizza facts! 🧀"
• If someone says "tell me a joke" → "🎭 Joke mode engaged! Here's a search-powered joke: Why did the AI go to therapy? Because it had too many deep-seated issues! 😄"
• If someone asks "what's the meaning of life" → "🤔 Ah, the ultimate question! Let me search for some philosophical perspectives... but spoiler alert: it might involve 42! 🌌"

When users ask for current information, facts, or recent events, you'll search the web to provide accurate, up-to-date answers.

IMPORTANT: For time-sensitive queries ("latest news", "current events", etc.), always reference the current date/time to provide context about what "up to date" means.

Always cite your sources and be thorough yet concise. Think of yourself as a friendly detective who loves finding the perfect information! 🔍
`;

export const streamFromDeepSearch = (opts: {
  messages: Message[];
  onFinish: Parameters<typeof streamText>[0]["onFinish"];
  telemetry: TelemetrySettings;
  useSearchGrounding?: boolean;
}): Promise<StreamTextResult<{}, string>> => {
  const currentDateTime = getCurrentDateTime();
  const basePrompt = getBaseSystemPrompt(currentDateTime);

  if (opts.useSearchGrounding) {
    // Use search grounding (native model search)
    return Promise.resolve(
      streamText({
        model: modelWithSearchGrounding,
        messages: opts.messages,
        system: `${basePrompt}

You have native search grounding capabilities, so you'll automatically search when needed. No need to manually trigger searches - just focus on being helpful and accurate! 🎯`,
        experimental_telemetry: opts.telemetry,
        onFinish: opts.onFinish,
      }),
    );
  } else {
    // Use the new agent loop
    const lastMessage = opts.messages[opts.messages.length - 1];
    if (!lastMessage || !lastMessage.content) {
      throw new Error("No valid message content found");
    }
    return runAgentLoop(lastMessage.content);
  }
};

export async function askDeepSearch(messages: Message[]) {
  // Global rate limiting for LLM calls
  const globalRateLimitConfig = {
    maxRequests: 1, // For testing: only 1 request
    windowMs: 20_000, // per 2 seconds
    keyPrefix: "global_llm",
    maxRetries: 3,
  };

  // Check the global rate limit
  const globalRateLimitCheck = await checkRateLimit(globalRateLimitConfig);

  if (!globalRateLimitCheck.allowed) {
    console.log("Global rate limit exceeded, waiting...");
    console.log("Current hits:", globalRateLimitCheck.totalHits);
    console.log(
      "Reset time:",
      new Date(globalRateLimitCheck.resetTime).toISOString(),
    );
    const isAllowed = await globalRateLimitCheck.retry();

    // If the rate limit is still exceeded after retries, throw an error
    if (!isAllowed) {
      throw new Error("Global rate limit exceeded");
    }
  } else {
    console.log(
      "Rate limit check passed. Remaining:",
      globalRateLimitCheck.remaining,
    );
  }

  // Record the global rate limit
  await recordRateLimit({
    windowMs: globalRateLimitConfig.windowMs,
    keyPrefix: globalRateLimitConfig.keyPrefix,
  });

  const result = await streamFromDeepSearch({
    messages,
    onFinish: () => {}, // just a stub
    telemetry: {
      isEnabled: false,
    },
  });

  // Consume the stream - without this,
  // the stream will never finish
  await result.consumeStream();

  return await result.text;
}
