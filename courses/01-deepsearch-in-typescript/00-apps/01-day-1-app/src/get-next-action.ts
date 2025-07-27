import { z } from "zod";
import { generateObject } from "ai";
import { model } from "../model";
import type { SystemContext } from "./system-context";
import { safeJsonParse } from "./utils";

type ContinueAction = {
  type: "continue";
  title: string;
  reasoning: string;
};

type AnswerAction = {
  type: "answer";
  title: string;
  reasoning: string;
};

type ErrorAction = {
  type: "error";
  message: string;
  title?: string;
  reasoning?: string;
};

type Action = ContinueAction | AnswerAction | ErrorAction;

export type { Action, ErrorAction };
export const actionSchema = z.object({
  type: z.enum(["continue", "answer"]).describe(
    `The type of action to take.
      - 'continue': Continue searching for more information to better answer the user's question.
      - 'answer': Answer the user's question and complete the loop.`,
  ),
  title: z
    .string()
    .describe(
      "The title of the action, to be displayed in the UI. Be extremely concise. 'Continuing research', 'Providing answer'",
    ),
  reasoning: z.string().describe("The reason you chose this step."),
});

export const getNextAction = async (
  context: SystemContext,
  langfuseTraceId?: string,
) => {
  let result;
  try {
    result = await generateObject({
      model,
      schema: actionSchema,
      system: `
Respond ONLY with a valid JSON object matching the schema provided. Do not include any commentary or extra text.

You are a helpful assistant that decides whether to continue searching for more information or to provide an answer to the user's question.

${context.getLocationPrompt()}

🔧 DECISION WORKFLOW:
- Use 'continue' when you need more information to provide a comprehensive answer
- Use 'answer' when you have sufficient information to provide a detailed, well-researched answer

💡 Continue searching when:
• You have limited or no search results
• The available information is incomplete or outdated
• You need to verify facts or get multiple perspectives
• The question requires current information that may not be in your results
• You need to fill gaps in your understanding

💡 Answer when:
• You have comprehensive search results from multiple sources
• The information is sufficient to provide a complete answer
• You have verified the information and can cite sources
• You've reached the maximum number of search iterations (10 steps)

⚡ CRITICAL RULES:
- Consider the conversation history when making decisions
- For follow-up questions, evaluate if you need more specific information
- Always prioritize providing accurate, well-sourced answers
- Don't continue searching indefinitely - know when you have enough information

🎯 PRO TIP: It's better to provide a comprehensive answer with good sources than to keep searching indefinitely!
`,
      prompt: `
Conversation History:
${context.getConversationHistory()}

Current User Question: ${context.getUserQuestion()}

DECISION RULES:
- If you have NO search results yet → use 'continue'
- If you have search results but need more information → use 'continue'
- If you have sufficient information to answer → use 'answer'
- For follow-up questions, consider if you need to search for more specific information

Current state:
- Search results: ${context.hasSearchResults() ? "Available" : "None"}
- Step: ${context.getStep()}

Here is the research context:

${context.getSearchHistory()}
    `,
      experimental_telemetry: langfuseTraceId
        ? {
            isEnabled: true,
            functionId: "agent-get-next-action",
            metadata: {
              langfuseTraceId,
            },
          }
        : undefined,
    });
    return result.object;
  } catch (err) {
    // Log error with tracing context
    console.error("LLM generation error:", {
      error: err,
      langfuseTraceId,
      step: context.getStep(),
      hasSearchResults: context.hasSearchResults(),
    });

    // Try to extract JSON from the error message or raw output
    let raw = "";
    if (
      result &&
      typeof result === "object" &&
      "raw" in result &&
      typeof result.raw === "string"
    ) {
      raw = result.raw;
    } else if (
      err &&
      typeof err === "object" &&
      err !== null &&
      "message" in err &&
      typeof (err as any).message === "string"
    ) {
      raw = (err as any).message;
    }

    // Use intelligent JSON parsing with auto-repair
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parseResult = safeJsonParse(match[0]);
      if (parseResult.success) {
        console.warn(
          "Successfully recovered from malformed JSON using auto-repair",
        );
        return parseResult.data;
      }
    }

    return {
      type: "error",
      message: `Malformed LLM output or JSON error: ${raw || "Unknown error"}`,
      context: {
        step: context.getStep(),
        hasSearchResults: context.hasSearchResults(),
        langfuseTraceId,
      },
    };
  }
};
