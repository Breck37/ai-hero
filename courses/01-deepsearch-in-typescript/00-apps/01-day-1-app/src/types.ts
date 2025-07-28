export interface LocationHints {
  latitude?: string;
  longitude?: string;
  city?: string;
  country?: string;
}

export type SearchResult = {
  date: string;
  title: string;
  url: string;
  snippet: string;
  scrapedContent: string; // Contains AI-generated summary of the scraped URL content
};

// Search source types for the display system
export type SearchSource = {
  title: string;
  url: string;
  snippet: string;
  favicon?: string;
  date?: string;
};

// Action types for the evaluator-optimizer loop
export type ContinueAction = {
  type: "continue";
  title: string;
  reasoning: string;
  feedback: string;
};

export type AnswerAction = {
  type: "answer";
  title: string;
  reasoning: string;
  feedback: string;
};

export type ErrorAction = {
  type: "error";
  message: string;
  title?: string;
  reasoning?: string;
  feedback?: string;
};

export type Action = ContinueAction | AnswerAction | ErrorAction;

// Query rewriter types
export type QueryRewriterResult = {
  plan: string;
  queries: string[];
};

// Message annotation types
export type OurMessageAnnotation =
  | {
      type: "NEW_ACTION";
      action: Action;
      queryPlan?: QueryRewriterResult;
    }
  | {
      type: "SEARCH_SOURCES";
      query: string;
      sources: SearchSource[];
    };
