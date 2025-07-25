import { z } from "zod";
import { generateObject } from "ai";
import { model } from "../model";
import type { SystemContext } from "./system-context";
import { safeJsonParse } from "./utils";

const queryRewriterSchema = z.object({
  plan: z
    .string()
    .describe(
      "A detailed research plan that outlines the logical progression of information needed to answer the user's question. This should break down the core components, identify dependencies, and consider multiple angles or perspectives.",
    ),
  queries: z
    .array(z.string())
    .describe(
      "A numbered list of 3-5 sequential search queries that are specific and focused, written in natural language without Boolean operators, and progress logically from foundational to specific information.",
    )
    .min(1)
    .max(5),
});

export type QueryRewriterResult = {
  plan: string;
  queries: string[];
};

export const queryRewriter = async (
  context: SystemContext,
  langfuseTraceId?: string,
): Promise<QueryRewriterResult> => {
  let result;
  try {
    result = await generateObject({
      model,
      schema: queryRewriterSchema,
      system: `You are a strategic research planner with expertise in breaking down complex questions into logical search steps. Your primary role is to create a detailed research plan before generating any search queries.

First, analyze the question thoroughly:
- Break down the core components and key concepts
- Identify any implicit assumptions or context needed
- Consider what foundational knowledge might be required
- Think about potential information gaps that need filling

Then, develop a strategic research plan that:
- Outlines the logical progression of information needed
- Identifies dependencies between different pieces of information
- Considers multiple angles or perspectives that might be relevant
- Anticipates potential dead-ends or areas needing clarification

Finally, translate this plan into a numbered list of 3-5 sequential search queries that:

- Are specific and focused (avoid broad queries that return general information)
- Are written in natural language without Boolean operators (no AND/OR)
- Progress logically from foundational to specific information
- Build upon each other in a meaningful way

Remember that initial queries can be exploratory - they help establish baseline information or verify assumptions before proceeding to more targeted searches. Each query should serve a specific purpose in your overall research plan.

${context.getLocationPrompt()}

Respond ONLY with a valid JSON object matching the schema provided. Do not include any commentary or extra text.`,
      prompt: `
Conversation History:
${context.getConversationHistory()}

Current User Question: ${context.getUserQuestion()}

Current state:
- Search results: ${context.hasSearchResults() ? "Available" : "None"}
- Step: ${context.getStep()}

Here is the research context:

${context.getSearchHistory()}

Please create a research plan and generate search queries to help answer the user's question.`,
      experimental_telemetry: langfuseTraceId
        ? {
            isEnabled: true,
            functionId: "agent-query-rewriter",
            metadata: {
              langfuseTraceId,
            },
          }
        : undefined,
    });
    return result.object;
  } catch (err) {
    // Log error with tracing context
    console.error("Query rewriter LLM generation error:", {
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

    // Fallback to a simple query based on the user's question
    console.warn("Query rewriter failed, using fallback query");
    return {
      plan: "Fallback plan: Direct search for the user's question",
      queries: [context.getUserQuestion()],
    };
  }
}; 