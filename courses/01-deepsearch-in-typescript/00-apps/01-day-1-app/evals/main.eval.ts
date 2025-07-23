import { evalite } from "evalite";
import { askDeepSearch } from "~/deep-search";
import type { Message } from "ai";
import { getEvaliteDataset } from "./utils";
import { Factuality } from "./initial.eval";
import { AnswerRelevancy } from "./answer-relevancy.eval";

// Main evaluation with Factuality and AnswerRelevancy scorers
evalite("Main Deep Search Eval", {
  data: async (): Promise<{ input: Message[]; expected: string }[]> => {
    return getEvaliteDataset();
  },
  task: async (input) => {
    return askDeepSearch(input);
  },
  scorers: [
    Factuality,
    AnswerRelevancy,
  ],
}); 