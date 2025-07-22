import type { Message } from "ai";
import { devData } from "./dev";
import { ciData } from "./ci";
import { regressionData } from "./regression";
import { env } from "~/env";

export type QuestionType =
  | "single-hop"
  | "multi-hop"
  | "comparison"
  | "temporal"
  | "technical-deep-dive";

export interface DatasetItem {
  id: string;
  name: string;
  type: QuestionType;
  input: string;
  expected: string;
  difficulty: "easy" | "medium" | "hard";
  description?: string;
}

// Reusable dataset resolution function
export const getDataset = () => {
  let data = devData;

  // If CI, add the CI data
  if (env.EVAL_DATASET === "ci") {
    data = [...devData, ...ciData];
  }
  // If Regression, add the regression data AND the CI data
  else if (env.EVAL_DATASET === "regression") {
    data = [...devData, ...ciData, ...regressionData];
  }

  return data;
};

// Convert DatasetItem[] to the format expected by evalite
export const getEvaliteDataset = () => {
  const data = getDataset();

  return data.map((item) => ({
    input: [
      {
        id: item.id,
        role: "user" as const,
        content: item.input,
      },
    ],
    expected: item.expected,
  }));
};

// Convert DatasetItem[] to the format expected by evalite with name field
export const getEvaliteDatasetWithNames = () => {
  const data = getDataset();

  return data.map((item) => ({
    name: item.name,
    input: [
      {
        id: item.id,
        role: "user" as const,
        content: item.input,
      },
    ],
    expected: item.expected,
  }));
};
