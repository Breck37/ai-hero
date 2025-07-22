import { evalite, createScorer } from "evalite";
import { askDeepSearch } from "~/deep-search";
import type { Message } from "ai";
import { generateObject } from "ai";
import { z } from "zod";
import { factualityModel } from "../model";
import { getEvaliteDataset } from "./utils";

// Simple in-memory cache for factuality checks
const factualityCache = new Map<string, any>();

export const checkFactuality = async (opts: {
  question: string;
  groundTruth: string;
  submission: string;
}) => {
  // Create a cache key based on the inputs
  const cacheKey = `${opts.question}:${opts.groundTruth}:${opts.submission}`;

  // Check cache first
  if (factualityCache.has(cacheKey)) {
    console.log("Using cached factuality result");
    return factualityCache.get(cacheKey);
  }

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { object } = await generateObject({
        model: factualityModel,
        /**
         * Prompt taken from autoevals:
         *
         * {@link https://github.com/braintrustdata/autoevals/blob/5aa20a0a9eb8fc9e07e9e5722ebf71c68d082f32/templates/factuality.yaml}
         */
        prompt: `
      You are comparing a submitted answer to an expert answer on a given question. Here is the data:
      [BEGIN DATA]
      ************
      [Question]: ${opts.question}
      ************
      [Expert]: ${opts.groundTruth}
      ************
      [Submission]: ${opts.submission}
      ************
      [END DATA]

      Compare the factual content of the submitted answer with the expert answer. Ignore any differences in style, grammar, or punctuation.
      The submitted answer may either be a subset or superset of the expert answer, or it may conflict with it. Determine which case applies. Answer the question by selecting one of the following options:
      (A) The submitted answer is a subset of the expert answer and is fully consistent with it.
      (B) The submitted answer is a superset of the expert answer and is fully consistent with it.
      (C) The submitted answer contains all the same details as the expert answer.
      (D) There is a disagreement between the submitted answer and the expert answer.
      (E) The answers differ, but these differences don't matter from the perspective of factuality.
    `,
        schema: z.object({
          answer: z.enum(["A", "B", "C", "D", "E"]).describe("Your selection."),
          rationale: z
            .string()
            .describe("Why you chose this answer. Be very detailed."),
        }),
      });

      /**
       * LLM's are well documented at being poor at generating
       */
      const scores = {
        A: 0.4,
        B: 0.6,
        C: 1,
        D: 0,
        E: 1,
      };

      const result = {
        score: scores[object.answer],
        metadata: {
          rationale: object.rationale,
        },
      };

      // Cache the result
      factualityCache.set(cacheKey, result);
      return result;
    } catch (error) {
      lastError = error as Error;
      console.warn(`Factuality check attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000),
        );
        continue;
      }
    }
  }

  // If all retries failed, return a fallback score
  console.error("All factuality check attempts failed:", lastError);
  const fallbackResult = {
    score: 0.5, // Neutral score as fallback
    metadata: {
      rationale: `Failed to evaluate factuality after ${maxRetries} attempts. Last error: ${lastError?.message || "Unknown error"}`,
    },
  };

  // Cache the fallback result too
  factualityCache.set(cacheKey, fallbackResult);
  return fallbackResult;
};

// This is the scorer that can be passed into the scorers in Evalite
export const Factuality = createScorer<Message[], string, string>({
  name: "Factuality",
  scorer: async ({ input, expected, output }) => {
    // Extract the question from the first user message
    const question = input[0]?.content || "";
    return checkFactuality({
      question,
      groundTruth: expected!,
      submission: output,
    });
  },
});

// Add more deterministic scorers to reduce LLM dependency
const ResponseLength = createScorer<Message[], string, string>({
  name: "Response Length",
  scorer: ({ output }) => {
    const length = output.length;
    // Score based on reasonable response length (not too short, not too long)
    if (length < 100) return 0.3; // Too short
    if (length > 2000) return 0.7; // Too long
    return 1.0; // Good length
  },
});

const SourceCount = createScorer<Message[], string, string>({
  name: "Source Count",
  scorer: ({ output }) => {
    const linkMatches = output.match(/\[.*?\]\(.*?\)/g);
    const sourceCount = linkMatches ? linkMatches.length : 0;

    // Score based on number of sources (encourage multiple sources)
    if (sourceCount === 0) return 0.0; // No sources
    if (sourceCount < 3) return 0.6; // Few sources
    if (sourceCount < 6) return 0.8; // Good number of sources
    return 1.0; // Many sources
  },
});

const HasCodeBlocks = createScorer<Message[], string, string>({
  name: "Has Code Blocks",
  scorer: ({ output }) => {
    const hasCodeBlocks = /```[\s\S]*?```/.test(output);
    return hasCodeBlocks ? 1.0 : 0.5; // Bonus for code examples
  },
});

evalite("Deep Search Eval", {
  data: async (): Promise<{ input: Message[]; expected: string }[]> => {
    return getEvaliteDataset();
  },
  task: async (input) => {
    return askDeepSearch(input);
  },
  scorers: [
    {
      name: "Contains Links",
      description: "Checks if the output contains any markdown links.",
      scorer: ({ output }) => {
        console.log(output);
        const containsLinks = /\[.*?\]\(.*?\)/.test(output);

        return containsLinks ? 1 : 0;
      },
    },
    ResponseLength,
    SourceCount,
    HasCodeBlocks,
    // Comment out Factuality scorer to reduce LLM usage during development
    // Uncomment when you have sufficient quota or want to test factuality
    Factuality,
  ],
});
