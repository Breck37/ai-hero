import ReactMarkdown, { type Components } from "react-markdown";
import type { Message } from "ai";

export type MessagePart = NonNullable<Message["parts"]>[number];

// Import ToolInvocation type for strong typing
import type { ToolInvocation } from "ai";

// Define the source type based on the documentation
type LanguageModelV1Source = {
  sourceType: "url";
  id: string;
  url: string;
  title?: string;
  providerMetadata?: {
    provider?: string;
    [key: string]: any;
  };
};

interface ChatMessageProps {
  parts: MessagePart[];
  role: string;
  userName: string;
}

const components: Components = {
  // Override default elements with custom styling
  p: ({ children }) => <p className="mb-4 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-4 list-disc pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 list-decimal pl-4">{children}</ol>,
  li: ({ children }) => <li className="mb-1">{children}</li>,
  code: ({ className, children, ...props }) => (
    <code className={`${className ?? ""}`} {...props}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded-lg bg-gray-700 p-4">
      {children}
    </pre>
  ),
  a: ({ children, ...props }) => (
    <a
      className="text-blue-400 underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
};

const Markdown = ({ children }: { children: string }) => {
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>;
};

// SourcePart: rendering for source message parts from search grounding
function SourcePart({ source }: { source: any }) {
  return (
    <div className="mb-4 rounded-lg border border-purple-500 bg-purple-950/60 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-purple-400">
        🔗 Source
      </div>
      <div className="mb-1 text-sm font-bold text-purple-300">
        {source.title || "Web Source"}
      </div>
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-purple-200 underline hover:text-purple-100"
      >
        {source.url}
      </a>
      {source.providerMetadata?.provider && (
        <div className="mt-1 text-xs text-purple-400 opacity-70">
          Provided by: {source.providerMetadata.provider}
        </div>
      )}
    </div>
  );
}

// ToolInvocationPart: pretty rendering for tool-invocation message parts
function ToolInvocationPart({
  toolInvocation,
}: {
  toolInvocation: ToolInvocation;
}) {
  const isSearchWeb = toolInvocation.toolName === "searchWeb";
  const isScrapePages = toolInvocation.toolName === "scrapePages";

  return (
    <div className="mb-4 rounded-lg border border-blue-500 bg-blue-950/60 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-400">
        {toolInvocation.state === "partial-call" && "Processing..."}
        {toolInvocation.state === "call" && "Complete"}
        {toolInvocation.state === "result" && "Results"}
      </div>

      <div className="mb-1 text-sm font-bold text-blue-300">
        {isSearchWeb
          ? "🔍 Web Search"
          : isScrapePages
            ? "📄 Page Scraping"
            : toolInvocation.toolName}
      </div>

      {toolInvocation.state !== "partial-call" && (
        <div className="text-xs text-blue-200">
          <span className="font-mono">
            {isSearchWeb ? "Query:" : isScrapePages ? "URLs:" : "Args:"}
          </span>
          <div className="mt-1 rounded bg-blue-900/60 p-2 text-blue-100">
            {isSearchWeb
              ? toolInvocation.args.query
              : isScrapePages
                ? toolInvocation.args.urls.join(", ")
                : JSON.stringify(toolInvocation.args)}
          </div>
        </div>
      )}

      {toolInvocation.state === "result" && toolInvocation.result && (
        <div className="mt-3">
          <div className="mb-2 text-xs text-green-200">
            <span className="font-mono">
              Found {toolInvocation.result.length} results:
            </span>
          </div>
          <div className="space-y-2">
            {toolInvocation.result.map((result: any, index: number) => (
              <div
                key={index}
                className="rounded border border-green-700/50 bg-green-900/30 p-3"
              >
                {isSearchWeb ? (
                  // Search Web results
                  <>
                    <a
                      href={result.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-1 block text-sm font-semibold text-green-300 underline hover:text-green-200"
                    >
                      {result.title}
                    </a>
                    <p className="text-xs leading-relaxed text-green-100">
                      {result.snippet}
                    </p>
                    <div className="mt-1 break-all text-xs text-green-400 opacity-70">
                      {result.link}
                    </div>
                  </>
                ) : isScrapePages ? (
                  // Scrape Pages results
                  <>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-1 block text-sm font-semibold text-green-300 underline hover:text-green-200"
                    >
                      {result.success
                        ? "✅ Scraped Successfully"
                        : "❌ Failed to Scrape"}
                    </a>
                    {result.success ? (
                      <div className="mt-2">
                        <div className="mb-1 text-xs text-green-400">
                          Content Preview:
                        </div>
                        <div className="max-h-32 overflow-y-auto text-xs leading-relaxed text-green-100">
                          {result.data.substring(0, 300)}...
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-red-300">
                        Error: {result.error}
                      </p>
                    )}
                    <div className="mt-1 break-all text-xs text-green-400 opacity-70">
                      {result.url}
                    </div>
                  </>
                ) : (
                  // Generic tool results
                  <div className="text-xs text-green-100">
                    {JSON.stringify(result, null, 2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const ChatMessage = ({ parts, role, userName }: ChatMessageProps) => {
  const isAI = role === "assistant";

  return (
    <div className="mb-6">
      <div
        className={`rounded-lg p-4 ${
          isAI ? "bg-gray-800 text-gray-300" : "bg-gray-900 text-gray-300"
        }`}
      >
        <p className="mb-2 text-sm font-semibold text-gray-400">
          {isAI ? "AI" : userName}
        </p>

        <div className="prose prose-invert max-w-none">
          {Array.isArray(parts) ? (
            parts.map((part, idx) => {
              // Hover over MessagePart to see all possible types!
              //
              // MessagePart can be:
              // - TextUIPart: { type: "text"; text: string; }
              // - ReasoningUIPart: { type: "reasoning"; reasoning: string; details: Array<...>; }
              // - ToolInvocationUIPart: { type: "tool-invocation"; toolInvocation: ToolInvocation; }
              // - SourceUIPart: { type: "source"; source: LanguageModelV1Source; }
              // - FileUIPart: { type: "file"; mimeType: string; data: string; }
              // - StepStartUIPart: { type: "step-start"; }

              if (part.type === "text") {
                return <Markdown key={idx}>{part.text}</Markdown>;
              }

              if (part.type === "tool-invocation") {
                return (
                  <ToolInvocationPart
                    key={idx}
                    toolInvocation={part.toolInvocation}
                  />
                );
              }

              if (part.type === "source") {
                return <SourcePart key={idx} source={part.source} />;
              }

              // You can add more handlers for other part types here:
              // if (part.type === "reasoning") {
              //   return <ReasoningPart key={idx} reasoning={part.reasoning} details={part.details} />;
              // }
              // if (part.type === "file") {
              //   return <FilePart key={idx} mimeType={part.mimeType} data={part.data} />;
              // }
              // if (part.type === "step-start") {
              //   return <StepStartPart key={idx} />;
              // }

              return null;
            })
          ) : (
            <p className="text-gray-400">Message content unavailable</p>
          )}
        </div>
      </div>
    </div>
  );
};
