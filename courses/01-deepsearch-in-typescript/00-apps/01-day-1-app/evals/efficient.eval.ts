import { evalite, createScorer } from "evalite";
import { askDeepSearch } from "~/deep-search";
import type { Message } from "ai";
import { getEvaliteDataset } from "./utils";

// Deterministic scorers that don't require LLM calls
const DeterministicScorers = {
  ContainsLinks: createScorer<Message[], string, string>({
    name: "Contains Links",
    description: "Checks if the output contains any markdown links.",
    scorer: ({ output }) => {
      const containsLinks = /\[.*?\]\(.*?\)/.test(output);
      return containsLinks ? 1 : 0;
    },
  }),

  ResponseLength: createScorer<Message[], string, string>({
    name: "Response Length",
    description: "Evaluates response length appropriateness.",
    scorer: ({ output }) => {
      const length = output.length;
      if (length < 100) return 0.3; // Too short
      if (length > 2000) return 0.7; // Too long
      return 1.0; // Good length
    },
  }),

  SourceCount: createScorer<Message[], string, string>({
    name: "Source Count",
    description: "Evaluates number of sources cited.",
    scorer: ({ output }) => {
      const linkMatches = output.match(/\[.*?\]\(.*?\)/g);
      const sourceCount = linkMatches ? linkMatches.length : 0;

      if (sourceCount === 0) return 0.0; // No sources
      if (sourceCount < 3) return 0.6; // Few sources
      if (sourceCount < 6) return 0.8; // Good number of sources
      return 1.0; // Many sources
    },
  }),

  HasCodeBlocks: createScorer<Message[], string, string>({
    name: "Has Code Blocks",
    description: "Checks for code examples in response.",
    scorer: ({ output }) => {
      const hasCodeBlocks = /```[\s\S]*?```/.test(output);
      return hasCodeBlocks ? 1.0 : 0.5;
    },
  }),

  LinkQuality: createScorer<Message[], string, string>({
    name: "Link Quality",
    description:
      "Evaluates quality of markdown links (descriptive titles vs raw URLs).",
    scorer: ({ output }) => {
      const linkMatches = output.match(/\[([^\]]+)\]\(([^)]+)\)/g);
      if (!linkMatches) return 0.0;

      let qualityScore = 0;
      let totalLinks = 0;

      linkMatches.forEach((match) => {
        const [, title, url] = match.match(/\[([^\]]+)\]\(([^)]+)\)/) || [];
        if (title && url) {
          totalLinks++;
          // Check if title is descriptive (not just the URL)
          const isDescriptive = title.length > 10 && !title.startsWith("http");
          const isNotRawUrl = !url.includes(title);
          if (isDescriptive && isNotRawUrl) {
            qualityScore += 1;
          } else if (isNotRawUrl) {
            qualityScore += 0.5;
          }
        }
      });

      return totalLinks > 0 ? qualityScore / totalLinks : 0;
    },
  }),

  Structure: createScorer<Message[], string, string>({
    name: "Response Structure",
    description: "Evaluates response structure and formatting.",
    scorer: ({ output }) => {
      let score = 0;

      // Check for headers
      if (/#{1,3}\s/.test(output)) score += 0.2;

      // Check for bullet points or numbered lists
      if (/^[\s]*[-*+]\s|^[\s]*\d+\.\s/m.test(output)) score += 0.2;

      // Check for paragraphs (multiple line breaks)
      if (/\n\n/.test(output)) score += 0.2;

      // Check for bold or italic text
      if (/\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_/.test(output)) score += 0.2;

      // Check for reasonable sentence structure
      const sentences = output
        .split(/[.!?]+/)
        .filter((s) => s.trim().length > 10);
      if (sentences.length >= 3) score += 0.2;

      return Math.min(score, 1.0);
    },
  }),
};

// Efficient evaluation that minimizes LLM usage
evalite("Efficient Deep Search Eval", {
  data: async () => getEvaliteDataset(),
  task: async (input) => {
    return askDeepSearch(input);
  },
  scorers: Object.values(DeterministicScorers),
});
