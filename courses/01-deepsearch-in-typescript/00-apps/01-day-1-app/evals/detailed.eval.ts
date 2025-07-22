import { evalite, createScorer } from "evalite";
import { askDeepSearch } from "~/deep-search";
import type { Message } from "ai";
import { getEvaliteDatasetWithNames } from "./utils";

// Enhanced scorers with detailed logging
const DetailedScorers = {
  ContainsLinks: createScorer<Message[], string, string>({
    name: "Contains Links",
    description: "Checks if the output contains any markdown links.",
    scorer: ({ output }) => {
      const containsLinks = /\[.*?\]\(.*?\)/.test(output);
      const linkCount = (output.match(/\[.*?\]\(.*?\)/g) || []).length;

      console.log(
        `  📎 Contains Links: ${containsLinks ? "✅" : "❌"} (${linkCount} links found)`,
      );
      return containsLinks ? 1 : 0;
    },
  }),

  ResponseLength: createScorer<Message[], string, string>({
    name: "Response Length",
    description: "Evaluates response length appropriateness.",
    scorer: ({ output }) => {
      const length = output.length;
      let score = 1.0;
      let status = "✅ Good";

      if (length < 100) {
        score = 0.3;
        status = "❌ Too short";
      } else if (length > 2000) {
        score = 0.7;
        status = "⚠️ Too long";
      }

      console.log(`  📏 Response Length: ${status} (${length} characters)`);
      return score;
    },
  }),

  SourceCount: createScorer<Message[], string, string>({
    name: "Source Count",
    description: "Evaluates number of sources cited.",
    scorer: ({ output }) => {
      const linkMatches = output.match(/\[.*?\]\(.*?\)/g);
      const sourceCount = linkMatches ? linkMatches.length : 0;

      let score = 0.0;
      let status = "❌ No sources";

      if (sourceCount === 0) {
        score = 0.0;
        status = "❌ No sources";
      } else if (sourceCount < 3) {
        score = 0.6;
        status = "⚠️ Few sources";
      } else if (sourceCount < 6) {
        score = 0.8;
        status = "✅ Good sources";
      } else {
        score = 1.0;
        status = "🌟 Many sources";
      }

      console.log(`  🔗 Source Count: ${status} (${sourceCount} sources)`);
      return score;
    },
  }),

  HasCodeBlocks: createScorer<Message[], string, string>({
    name: "Has Code Blocks",
    description: "Checks for code examples in response.",
    scorer: ({ output }) => {
      const hasCodeBlocks = /```[\s\S]*?```/.test(output);
      const codeBlockCount = (output.match(/```[\s\S]*?```/g) || []).length;

      const score = hasCodeBlocks ? 1.0 : 0.5;
      const status = hasCodeBlocks
        ? `✅ Has code (${codeBlockCount} blocks)`
        : "⚠️ No code examples";

      console.log(`  💻 Code Blocks: ${status}`);
      return score;
    },
  }),

  LinkQuality: createScorer<Message[], string, string>({
    name: "Link Quality",
    description:
      "Evaluates quality of markdown links (descriptive titles vs raw URLs).",
    scorer: ({ output }) => {
      const linkMatches = output.match(/\[([^\]]+)\]\(([^)]+)\)/g);
      if (!linkMatches) {
        console.log(`  🎯 Link Quality: ❌ No links found`);
        return 0.0;
      }

      let qualityScore = 0;
      let totalLinks = 0;
      let descriptiveLinks = 0;
      let rawUrlLinks = 0;

      linkMatches.forEach((match) => {
        const [, title, url] = match.match(/\[([^\]]+)\]\(([^)]+)\)/) || [];
        if (title && url) {
          totalLinks++;
          const isDescriptive = title.length > 10 && !title.startsWith("http");
          const isNotRawUrl = !url.includes(title);

          if (isDescriptive && isNotRawUrl) {
            qualityScore += 1;
            descriptiveLinks++;
          } else if (isNotRawUrl) {
            qualityScore += 0.5;
            descriptiveLinks++;
          } else {
            rawUrlLinks++;
          }
        }
      });

      const finalScore = totalLinks > 0 ? qualityScore / totalLinks : 0;
      const status =
        finalScore >= 0.8
          ? "✅ High quality"
          : finalScore >= 0.5
            ? "⚠️ Mixed quality"
            : "❌ Poor quality";

      console.log(
        `  🎯 Link Quality: ${status} (${descriptiveLinks}/${totalLinks} descriptive, ${rawUrlLinks} raw URLs)`,
      );
      return finalScore;
    },
  }),

  Structure: createScorer<Message[], string, string>({
    name: "Response Structure",
    description: "Evaluates response structure and formatting.",
    scorer: ({ output }) => {
      let score = 0;
      const features = [];

      // Check for headers
      if (/#{1,3}\s/.test(output)) {
        score += 0.2;
        features.push("headers");
      }

      // Check for bullet points or numbered lists
      if (/^[\s]*[-*+]\s|^[\s]*\d+\.\s/m.test(output)) {
        score += 0.2;
        features.push("lists");
      }

      // Check for paragraphs (multiple line breaks)
      if (/\n\n/.test(output)) {
        score += 0.2;
        features.push("paragraphs");
      }

      // Check for bold or italic text
      if (/\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_/.test(output)) {
        score += 0.2;
        features.push("formatting");
      }

      // Check for reasonable sentence structure
      const sentences = output
        .split(/[.!?]+/)
        .filter((s) => s.trim().length > 10);
      if (sentences.length >= 3) {
        score += 0.2;
        features.push("sentences");
      }

      const finalScore = Math.min(score, 1.0);
      const status =
        finalScore >= 0.8
          ? "✅ Well structured"
          : finalScore >= 0.5
            ? "⚠️ Basic structure"
            : "❌ Poor structure";

      console.log(
        `  📝 Structure: ${status} (${features.join(", ") || "none"})`,
      );
      return finalScore;
    },
  }),
};

// Enhanced evaluation with detailed logging
evalite("Detailed Deep Search Eval", {
  data: async () => getEvaliteDatasetWithNames(),
  task: async (input: Message[]) => {
    // Get the current test case from the dataset
    const dataset = getEvaliteDatasetWithNames();
    const currentIndex = dataset.findIndex(
      (t) => t.input[0]?.content === input[0]?.content,
    );

    if (currentIndex >= 0) {
      const testCase = dataset[currentIndex];
      console.log(`\n🔍 Running test: ${testCase?.name || "Unknown"}`);
      console.log(`   Question: "${testCase?.input[0]?.content || "Unknown"}"`);
    } else {
      console.log(`\n🔍 Running test: Unknown`);
      console.log(`   Question: "${input[0]?.content || "Unknown"}"`);
    }

    try {
      const result = await askDeepSearch(input);

      console.log(`   Response length: ${result.length} characters`);
      console.log(
        `   Sources found: ${(result.match(/\[.*?\]\(.*?\)/g) || []).length}`,
      );

      return result;
    } catch (error) {
      console.error(
        `   ❌ Error during evaluation: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return `Evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
  scorers: Object.values(DetailedScorers),
});
