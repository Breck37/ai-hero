/**
 * Debounce function to limit how often a function can be called
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function to limit how often a function can be called
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Check if a chat is newly created based on data stream
 */
export function isNewChatCreated(
  dataItem: any,
): dataItem is { chatId: string } {
  return dataItem && typeof dataItem === "object" && "chatId" in dataItem;
}

/**
 * Performance optimization: Memoize expensive computations
 */
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  getKey?: (...args: Parameters<T>) => string,
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = getKey ? getKey(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = func(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Batch DOM updates for better performance
 */
export function batchDOMUpdates(updates: (() => void)[]): void {
  if (
    typeof window !== "undefined" &&
    typeof window.requestAnimationFrame === "function"
  ) {
    window.requestAnimationFrame(() => {
      updates.forEach((update) => update());
    });
  } else {
    updates.forEach((update) => update());
  }
}

/**
 * Optimize scroll performance by using passive listeners
 */
export function addPassiveScrollListener(
  element: HTMLElement,
  handler: (event: Event) => void,
): () => void {
  element.addEventListener("scroll", handler, { passive: true });

  return () => {
    element.removeEventListener("scroll", handler);
  };
}

/**
 * Clean content for display/logging - replaces problematic characters with spaces, preserves newlines
 */
export function sanitizeForDisplay(str: string): string {
  if (typeof str !== "string") {
    return String(str);
  }

  return (
    str
      // First normalize line endings
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      // Replace control characters with spaces (excluding newlines \x0A and carriage returns \x0D)
      .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, " ")
      // Replace Unicode line separators with newlines
      .replace(/[\u2028\u2029]/g, "\n")
      // Replace literal escape sequences that might appear as text (except \n)
      .replace(/\\[bfrtv]/g, " ")
      .replace(/\\n/g, "\n")
      // Replace remaining backslashes
      .replace(/\\/g, " ")
      // Clean up excessive whitespace on each line, but preserve newlines
      .replace(/[ \t]+/g, " ")
      // Remove trailing spaces from each line
      .replace(/ +$/gm, "")
      // Remove leading spaces from each line
      .replace(/^ +/gm, "")
      .trim()
  );
}

/**
 * Enhanced JSON sanitization that handles all problematic characters
 * This prevents malformed JSON from corrupting LLM inputs
 * ONLY use this when embedding content in JSON strings!
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
 * Attempts to clean and fix common display issues in text content
 * Use this for content that will be displayed, not embedded in JSON
 */
export function cleanTextContent(content: string): string {
  if (typeof content !== "string") {
    return String(content);
  }

  // Start with basic sanitization that removes problematic characters
  let cleaned = sanitizeForDisplay(content);

  // Remove potential markdown/HTML that might contain unescaped quotes
  cleaned = cleaned
    .replace(/```[\s\S]*?```/g, "[code block]")
    .replace(/<[^>]*>/g, "")
    // Fix common quote issues (replace smart quotes with regular ones)
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"');

  return cleaned.trim();
}

/**
 * Attempts to clean and fix common JSON issues in text content
 * Use this ONLY when preparing content to be embedded in JSON
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
    .map((part) => cleanTextContent(part.text || ""))
    .join(" ")
    .trim();
}

/**
 * Safely processes scraped content for display and processing
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

  // Apply comprehensive cleaning for display
  processed = cleanTextContent(processed);

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

  // Apply comprehensive cleaning for JSON contexts
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
 * Validates and cleans content before sending to LLM
 * LLM prompts are strings, not JSON, so we just need display cleaning
 */
export function prepareLLMContent(content: string): string {
  if (!content || typeof content !== "string") {
    return "";
  }

  // Clean for display - no JSON escaping needed for LLM prompts
  return cleanTextContent(content);
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

/**
 * Extract favicon URL from a website URL
 */
export const getFaviconUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
  } catch {
    // Fallback for invalid URLs
    return "";
  }
};

// Global state to track Tavily usage limits
let tavilyLimitExceeded = false;

export const setTavilyLimitExceeded = (exceeded: boolean) => {
  tavilyLimitExceeded = exceeded;
};

export const isTavilyLimitExceeded = () => {
  return tavilyLimitExceeded;
};
