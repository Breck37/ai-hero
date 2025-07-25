export function isNewChatCreated(data: unknown): data is {
  type: "NEW_CHAT_CREATED";
  chatId: string;
} {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === "NEW_CHAT_CREATED" &&
    "chatId" in data &&
    typeof data.chatId === "string"
  );
}

/**
 * Enhanced JSON sanitization that handles all problematic characters
 * This prevents malformed JSON from corrupting LLM inputs
 */
export function sanitizeForJson(str: string): string {
  if (typeof str !== "string") {
    return String(str);
  }

  return (
    str
      // Escape backslashes first (must be first)
      .replace(/\\/g, "\\\\")
      // Escape double quotes
      .replace(/"/g, '\\"')
      // Escape control characters
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t")
      .replace(/\b/g, "\\b")
      .replace(/\f/g, "\\f")
      // Remove or escape other control characters (0x00-0x1F except those handled above)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, (char) => {
        return "\\u" + ("0000" + char.charCodeAt(0).toString(16)).slice(-4);
      })
      // Handle potential Unicode issues
      .replace(/\u2028/g, "\\u2028") // Line separator
      .replace(/\u2029/g, "\\u2029")
  ); // Paragraph separator
}

/**
 * Attempts to clean and fix common JSON issues in text content
 */
export function cleanJsonContent(content: string): string {
  if (typeof content !== "string") {
    return String(content);
  }

  // First, apply basic sanitization
  let cleaned = sanitizeForJson(content);

  // Remove or replace problematic patterns that commonly break JSON
  cleaned = cleaned
    // Remove excessive whitespace that might contain hidden characters
    .replace(/\s+/g, " ")
    // Remove potential markdown/HTML that might contain unescaped quotes
    .replace(/```[\s\S]*?```/g, "[code block]")
    .replace(/<[^>]*>/g, "")
    // Fix common quote issues
    .replace(/'/g, "'") // Smart quotes
    .replace(/'/g, "'")
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    // Remove or replace other potentially problematic characters
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ""); // Remove control characters

  return cleaned.trim();
}

/**
 * Safely extracts text content from potentially malformed message parts
 */
export function extractSafeTextContent(parts: any[]): string {
  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .filter((part) => part && typeof part === "object" && part.type === "text")
    .map((part) => cleanJsonContent(part.text || ""))
    .join(" ")
    .trim();
}

/**
 * Safely processes scraped content to prevent JSON corruption
 */
export function sanitizeScrapedContent(content: string): string {
  if (!content || typeof content !== "string") {
    return "";
  }

  // Limit extremely long content that might cause issues
  const maxLength = 10000; // Reasonable limit for scraped content
  let processed =
    content.length > maxLength
      ? content.substring(0, maxLength) + "...[content truncated]"
      : content;

  // Apply comprehensive cleaning
  processed = cleanJsonContent(processed);

  // Additional checks for scraped content
  processed = processed
    // Remove script and style content that might have unescaped content
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    // Clean up markdown tables that might have formatting issues
    .replace(/\|[\s\S]*?\|/g, (match) => {
      return match.replace(/\n/g, " ").replace(/\s+/g, " ");
    });

  return processed;
}

/**
 * Detects potential JSON corruption patterns in text content
 */
export function detectJsonIssues(
  content: string,
): Array<{ type: string; position: number; issue: string }> {
  const issues: Array<{ type: string; position: number; issue: string }> = [];

  // Check for common problematic patterns
  const patterns = [
    {
      pattern: /\\"(?=[^"]*$)/g,
      type: "unescaped_quote",
      description: "Unescaped quote at end",
    },
    {
      pattern: /[\x00-\x08\x0B\x0C\x0E-\x1F]/g,
      type: "control_char",
      description: "Control character",
    },
    {
      pattern: /\u2028|\u2029/g,
      type: "line_separator",
      description: "Unicode line separator",
    },
    {
      pattern: /\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g,
      type: "invalid_escape",
      description: "Invalid escape sequence",
    },
    {
      pattern: /"[^"]*\n[^"]*"/g,
      type: "unescaped_newline",
      description: "Unescaped newline in string",
    },
  ];

  for (const { pattern, type, description } of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      issues.push({
        type,
        position: match.index,
        issue: description,
      });
    }
  }

  return issues;
}

/**
 * Intelligently repairs common JSON corruption issues
 */
export function repairJsonContent(content: string): {
  repaired: string;
  issues: number;
} {
  let repaired = content;
  let issueCount = 0;

  // Track issues before repair
  const initialIssues = detectJsonIssues(repaired);
  issueCount = initialIssues.length;

  if (issueCount === 0) {
    return { repaired, issues: 0 };
  }

  // Apply comprehensive cleaning
  repaired = cleanJsonContent(repaired);

  // Additional intelligent repairs
  repaired = repaired
    // Fix common JSON string issues
    .replace(/"\s*\n\s*"/g, '" "') // Replace newlines between quotes with space
    .replace(/"\s*,\s*\n\s*"/g, '", "') // Fix comma-separated strings with newlines
    // Fix bracket and brace issues
    .replace(/\[\s*,/g, "[") // Remove leading commas in arrays
    .replace(/,\s*\]/g, "]") // Remove trailing commas in arrays
    .replace(/\{\s*,/g, "{") // Remove leading commas in objects
    .replace(/,\s*\}/g, "}") // Remove trailing commas in objects
    // Fix common escape issues
    .replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, "\\\\") // Fix invalid escapes
    // Normalize whitespace around JSON structural characters
    .replace(/\s*:\s*/g, ":")
    .replace(/\s*,\s*/g, ",")
    .replace(/\s*\{\s*/g, "{")
    .replace(/\s*\}\s*/g, "}")
    .replace(/\s*\[\s*/g, "[")
    .replace(/\s*\]\s*/g, "]");

  return { repaired, issues: issueCount };
}

/**
 * Validates and repairs content before sending to LLM
 */
export function prepareLLMContent(content: string): string {
  if (!content || typeof content !== "string") {
    return "";
  }

  // First, detect and repair any JSON issues
  const { repaired, issues } = repairJsonContent(content);

  if (issues > 0) {
    console.warn(
      `Repaired ${issues} JSON issues in content before sending to LLM`,
    );
  }

  return repaired;
}

/**
 * Safe JSON parsing with automatic repair attempts
 */
export function safeJsonParse<T = any>(
  jsonString: string,
): { success: boolean; data?: T; error?: string } {
  if (!jsonString || typeof jsonString !== "string") {
    return { success: false, error: "Invalid input: not a string" };
  }

  // First attempt: try parsing as-is
  try {
    const parsed = JSON.parse(jsonString);
    return { success: true, data: parsed };
  } catch (originalError) {
    // Second attempt: try with basic repair
    try {
      const { repaired } = repairJsonContent(jsonString);
      const parsed = JSON.parse(repaired);
      console.warn("JSON successfully repaired and parsed");
      return { success: true, data: parsed };
    } catch (repairError) {
      return {
        success: false,
        error: `JSON parsing failed even after repair: ${repairError instanceof Error ? repairError.message : "Unknown error"}`,
      };
    }
  }
}
