import ReactMarkdown, { type Components } from "react-markdown";
import type { Message } from "ai";

export type MessagePart = NonNullable<Message["parts"]>[number];

// Import ToolInvocation type for strong typing
import type { ToolInvocation } from "ai";

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

// ToolInvocationPart: pretty rendering for tool-invocation message parts
function ToolInvocationPart({
  toolInvocation,
}: {
  toolInvocation: ToolInvocation;
}) {
  // Helper to render sources as links if result is an array of { title, url }
  function renderResult(result: any) {
    if (
      Array.isArray(result) &&
      result.length > 0 &&
      result.every(
        (item) =>
          item &&
          typeof item === "object" &&
          typeof item.title === "string" &&
          typeof item.link === "string",
      )
    ) {
      return (
        <div className="mt-1 flex flex-col gap-2">
          {result.map((item, i) => (
            <a
              key={i}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 underline hover:text-blue-300"
            >
              {item.title}
            </a>
          ))}
        </div>
      );
    }
    // Fallback: render as JSON
    return (
      <pre className="mt-1 overflow-x-auto rounded bg-green-900/60 p-2 text-green-100">
        {JSON.stringify(result, null, 2)}
      </pre>
    );
  }
  return (
    <div className="mb-4 rounded-lg border border-blue-500 bg-blue-950/60 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-400">
        Tool Call
      </div>
      <div className="mb-1 text-sm font-bold text-blue-300">
        {toolInvocation.toolName}
      </div>
      <div className="text-xs text-blue-200">
        <span className="font-mono">Args:</span>
        <pre className="mt-1 overflow-x-auto rounded bg-blue-900/60 p-2 text-blue-100">
          {JSON.stringify(toolInvocation.args, null, 2)}
        </pre>
      </div>
      {toolInvocation.state === "result" && (
        <div className="mt-3 text-xs text-green-200">
          <span className="font-mono">Result:</span>
          {renderResult(toolInvocation.result)}
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
          {parts.map((part, idx) => {
            // Hover over MessagePart to see all possible types!
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
            // You can add more handlers for other part types here
            return null;
          })}
        </div>
      </div>
    </div>
  );
};
