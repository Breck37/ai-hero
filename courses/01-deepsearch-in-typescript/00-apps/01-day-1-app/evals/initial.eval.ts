import { evalite, createScorer } from "evalite";
import { askDeepSearch } from "~/deep-search";
import type { Message } from "ai";
import { generateObject } from "ai";
import { z } from "zod";
import { factualityModel } from "../model";

// Statement generation prompt
function generateEvaluationStatementsPrompt({ output }: { output: string }) {
  return `Given the text, break it down into meaningful statements while preserving context and relationships.
Don't split too aggressively.

Split compound statements particularly when they:
- Are joined by "and"
- Contain multiple distinct facts or claims
- Have multiple descriptive elements about the subject


Handle special cases:
- A single word answer should be treated as a complete statement
- Error messages should be treated as a single statement
- Empty strings should return an empty list
- When splitting text, keep related information together

Example:
Example text: Look! A bird! Birds are an interesting animal.

{
    "statements": ["Look!", "A bird!", "Birds are interesting animals."]
}

Please return only JSON format with "statements" array.
Return empty list for empty input.

Text:
${output}

JSON:
`;
}

// Answer relevancy agent instructions (system prompt)
const ANSWER_RELEVANCY_AGENT_INSTRUCTIONS = `You are a balanced and nuanced answer relevancy evaluator. Your job is to determine if LLM outputs are relevant to the input, including handling partially relevant or uncertain cases.

Key Principles:
1. Evaluate whether the output addresses what the input is asking for
2. Consider both direct answers and related context
3. Prioritize relevance to the input over correctness
4. Recognize that responses can be partially relevant
5. Empty inputs or error messages should always be marked as "no"
6. Responses that discuss the type of information being asked show partial relevance`;

// Relevancy evaluation prompt
function generateEvaluatePrompt({
  input,
  statements,
}: {
  input: string;
  statements: string[];
}) {
  return `Evaluate each statement's relevance to the input question, considering direct answers, related context, and uncertain cases.

    Return JSON with array of verdict objects. Each verdict must include:
    - "verdict": "yes", "no", or "unsure"
    - "reason": Clear explanation of the verdict

    Verdict Guidelines:
    - "yes": Statement explicitly and directly answers the input question when it:
        * Contains specific answer to the question asked (e.g., "The color of the sky is blue")
        * States explicit relationship between key concepts (e.g., "X is the CEO of company Y")
        * Can stand alone as a complete answer
        * Contains appropriate question-type response (e.g., location for "where", person for "who")
        * Note: If statement is incorrect but directly addresses the question, mark as "unsure"

    - "unsure": Statement shows partial relevance when it:
        * Discusses the type of information being asked about (e.g., mentions temperatures when asked about temperature)
        * Contains information about the answer without explicit statement
        * Uses importance indicators ("main", "primary", "major") with relevant concepts
        * Includes indirect references to the answer (e.g., "where the president works")
        * Contains topic-related administrative/governance terms without direct answer
        * References functions or characteristics typically associated with the answer
        * Uses terms that match what's being asked about
        * Mentions related entities without specifying their relationship to the answer
        * Is incorrect but shows understanding of the question
        * Contains the answer term but needs more context to be complete
        * Contains measurement units or quantities relevant to the question type
        * References locations or entities in the same category as what's being asked about
        * Provides relevant information without using explicit question-type terminology
        * Contains references to properties of the subject that relate to the question type


    - "no": Statement lacks meaningful connection to question when it:
        * Contains neither the subject nor the type of information being requested
        * Contains no terms related to what's being asked about
        * Contains only general subject information without relating to what's being asked
        * Consists of empty or meaningless content
        * Contains purely tangential information with no mention of the subject or question type
        * Discusses the subject but not the specific attribute being asked about
        * Note: Assessment is about connection to what's being asked, not factual accuracy
        * Contains no connection to what's being asked about (neither the subject nor the type of information requested)

    REMEMBER: 
    - If the statement contains words or phrases that are relevant to the input, it is partially relevant.
    - If the statement is a direct answer to the input, it is relevant.
    - If the statement is completely unrelated to the input or contains nothing, it is not relevant.
    - DO NOT MAKE A JUDGEMENT ON THE CORRECTNESS OF THE STATEMENT, JUST THE RELEVANCY.

    STRICT RULES:
    - If a statement mentions the type of information being requested, it should be marked as "unsure" ONLY if it's discussing that type meaningfully (not just mentioning it)
    - Subject mentions alone are NOT enough for relevance - they must connect to what's being asked about
    - Empty or meaningless statements are always "no"
    - General facts about the subject without connection to the question type should be marked as "no"
    - ALWAYS mark a statement as "no" if it discusses the topic without any connection to the question type
    - Statements that mention neither the subject nor the type of information are always "no"
    - Type-level relevance overrides topic-only content
    - Measurement/quantity relevance counts as type-level relevance
    - Administrative/governance terms are only relevant if they relate to the question type
    - Descriptive facts about the subject should be marked as "no" unless they directly relate to the question type


    Examples of "no" statements:
        * "Japan has beautiful seasons" for "What is Japan's largest city?"
        * "Trees grow tall" for "How tall is Mount Everest?"
        * "The weather is nice" for "Who is the president?"

    Example:
    Input: "What color is the sky during daytime?"
    Statements: [
      "The sky is blue during daytime",
      "The sky is full of clouds", 
      "I had breakfast today",
      "Blue is a beautiful color",
      "Many birds fly in the sky",
      "",
      "The sky is purple during daytime",
      "Daytime is when the sun is up",
    ]
    JSON:
    {
        "verdicts": [
            {
                "verdict": "yes",
                "reason": "This statement explicitly answers what color the sky is during daytime"
            },
            {
                "verdict": "unsure",
                "reason": "This statement describes the sky but doesn't address its color"
            },
            {
                "verdict": "no",
                "reason": "This statement about breakfast is completely unrelated to the sky"
            },
            {
                "verdict": "unsure",
                "reason": "This statement about blue is related to color but doesn't address the sky"
            },
            {
                "verdict": "unsure",
                "reason": "This statement is about the sky but doesn't address its color"
            },
            {
                "verdict": "no",
                "reason": "This statement is empty"
            },
            {
                "verdict": "unsure",
                "reason": "This statement is incorrect but contains relevant information and still addresses the question"
            },
            {
                "verdict": "no",
                "reason": "This statement is about daytime but doesn't address the sky"
            }
        ]
    }

The number of verdicts MUST MATCH the number of statements exactly.

  Input:
  ${input}

  Number of statements: ${statements.length === 0 ? "1" : statements.length}

  Statements:
  ${statements}

  JSON:
  `;
}

// Answer relevancy checker using LLM-as-a-judge
const checkAnswerRelevancy = async (opts: {
  input: string;
  output: string;
}) => {
  // Step 1: Break down the output into statements
  const { object: statementResult } = await generateObject({
    model: factualityModel,
    prompt: generateEvaluationStatementsPrompt({
      output: opts.output,
    }),
    schema: z.object({
      statements: z
        .array(z.string())
        .describe("Array of statements from the output"),
    }),
  });

  const statements = statementResult.statements;

  // If no statements, return 0 score
  if (statements.length === 0) {
    return {
      score: 0,
      metadata: {
        statements: [],
        verdicts: [],
        rationale: "No statements found in output",
      },
    };
  }

  // Step 2: Evaluate each statement's relevance
  const { object: verdictResult } = await generateObject({
    model: factualityModel,
    system: ANSWER_RELEVANCY_AGENT_INSTRUCTIONS,
    prompt: generateEvaluatePrompt({
      input: opts.input,
      statements,
    }),
    schema: z.object({
      verdicts: z
        .array(
          z.object({
            verdict: z
              .enum(["yes", "no", "unsure"])
              .describe("Relevance verdict"),
            reason: z.string().describe("Explanation for the verdict"),
          }),
        )
        .describe("Array of verdicts for each statement"),
    }),
  });

  const verdicts = verdictResult.verdicts;

  // Step 3: Convert verdicts to scores and calculate average
  const scores = {
    yes: 1,
    no: 0,
    unsure: 0.5,
  };

  const statementScores = verdicts.map((verdict) => scores[verdict.verdict]);
  const averageScore =
    statementScores.reduce((sum, score) => sum + score, 0) /
    statementScores.length;

  return {
    score: averageScore,
    metadata: {
      statements,
      verdicts,
      rationale: `Evaluated ${statements.length} statements with average relevancy score of ${averageScore.toFixed(2)}`,
    },
  };
};

// Factuality checker using LLM-as-a-judge
const checkFactuality = async (opts: {
  question: string;
  groundTruth: string;
  submission: string;
}) => {
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
    A: 0.6,
    B: 0.9,
    C: 1,
    D: 0,
    E: 1,
  };

  return {
    score: scores[object.answer],
    metadata: {
      rationale: object.rationale,
    },
  };
};

// This is the scorer that can be passed into the scorers in Evalite
const Factuality = createScorer<string, string, string>({
  name: "Factuality",
  scorer: async ({ input, expected, output }) => {
    console.log("\n=== FACTUALITY EVALUATION ===");
    console.log("Question:", input);
    console.log("Expected:", expected);
    console.log("Actual Output:", output);

    const result = await checkFactuality({
      question: input,
      groundTruth: expected!,
      submission: output,
    });

    console.log("Factuality Score:", result.score);
    console.log("Rationale:", result.metadata.rationale);
    console.log("==============================\n");

    return result;
  },
});

// This is the scorer that can be passed into the scorers in Evalite
const AnswerRelevancy = createScorer<string, string, string>({
  name: "Answer Relevancy",
  scorer: async ({ input, output }) => {
    console.log("\n=== ANSWER RELEVANCY EVALUATION ===");
    console.log("Question:", input);
    console.log("Output:", output);

    const result = await checkAnswerRelevancy({
      input,
      output,
    });

    console.log("Relevancy Score:", result.score);
    console.log("Statements:", result.metadata.statements);
    console.log("Verdicts:", result.metadata.verdicts);
    console.log("Rationale:", result.metadata.rationale);
    console.log("====================================\n");

    return result;
  },
});

evalite("Deep Search Eval", {
  data: async (): Promise<{ input: string; expected: string }[]> => {
    return [
      {
        input: "What is the latest version of TypeScript?",
        expected: "The current TypeScript version is 5.8",
      },
      {
        input: "What are the main features of Next.js 15?",
        expected: `
@next/codemod CLI: Easily upgrade to the latest Next.js and React versions.
Async Request APIs (Breaking): Incremental step towards a simplified rendering and caching model.
Caching Semantics (Breaking): fetch requests, GET Route Handlers, and client navigations are no longer cached by default.
React 19 Support: Support for React 19, React Compiler (Experimental), and hydration error improvements.
Turbopack Dev (Stable): Performance and stability improvements.
Static Indicator: New visual indicator shows static routes during development.
unstable_after API (Experimental): Execute code after a response finishes streaming.
instrumentation.js API (Stable): New API for server lifecycle observability.
Enhanced Forms (next/form): Enhance HTML forms with client-side navigation.
next.config: TypeScript support for next.config.ts.
Self-hosting Improvements: More control over Cache-Control headers.
Server Actions Security: Unguessable endpoints and removal of unused actions.
Bundling External Packages (Stable): New config options for App and Pages Router.
ESLint 9 Support: Added support for ESLint 9.
Development and Build Performance: Improved build times and Faster Fast Refresh.
`,
      },
      {
        input: "How do I make a cup of coffee?",
        expected:
          "Instructions for making coffee using various methods like drip, pour-over, French press, or espresso machine.",
      },
    ];
  },
  task: async (input: string) => {
    console.log("Starting evaluation at:", new Date().toISOString());
    // Convert string input to Message[] format for askDeepSearch
    const messages: Message[] = [
      {
        id: "1",
        role: "user",
        content: input,
      },
    ];
    const result = await askDeepSearch(messages);
    console.log("Finished evaluation at:", new Date().toISOString());
    return result;
  },
  scorers: [
    {
      name: "Contains Links",
      description: "Checks if the output contains any markdown links.",
      scorer: ({ output }) => {
        const containsLinks = /\[.*?\]\(.*?\)/.test(output);
        const score = containsLinks ? 1 : 0;
        console.log(`\n=== CONTAINS LINKS SCORE: ${score * 100}% ===`);
        console.log(`Output contains links: ${containsLinks}`);
        console.log("==========================================\n");
        return score;
      },
    },
    {
      name: "Factuality",
      description: "Evaluates factual accuracy against ground truth.",
      scorer: async ({ input, expected, output }) => {
        console.log("\n=== FACTUALITY EVALUATION ===");
        console.log("Question:", input);
        console.log("Expected:", expected);
        console.log("Actual Output:", output);

        const result = await checkFactuality({
          question: input,
          groundTruth: expected!,
          submission: output,
        });

        console.log("Factuality Score:", result.score * 100 + "%");
        console.log("Rationale:", result.metadata.rationale);
        console.log("==============================\n");

        return result.score;
      },
    },
    {
      name: "Answer Relevancy",
      description: "Evaluates how relevant the answer is to the question.",
      scorer: async ({ input, output }) => {
        console.log("\n=== ANSWER RELEVANCY EVALUATION ===");
        console.log("Question:", input);
        console.log("Output:", output);

        const result = await checkAnswerRelevancy({
          input,
          output,
        });

        console.log("Relevancy Score:", result.score * 100 + "%");
        console.log("Statements:", result.metadata.statements);
        console.log("Verdicts:", result.metadata.verdicts);
        console.log("Rationale:", result.metadata.rationale);
        console.log("====================================\n");

        return result.score;
      },
    },
  ],
});
