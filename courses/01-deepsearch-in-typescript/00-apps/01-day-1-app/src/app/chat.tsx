"use client";

import { ChatMessage } from "~/components/chat-message";
import { useChat } from "@ai-sdk/react";
import { Square, AlertTriangle, WifiOff } from "lucide-react";
import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { isNewChatCreated, isTavilyLimitExceeded } from "~/utils";
import { StickToBottom } from "use-stick-to-bottom";
import type { Message } from "ai";
import type { OurMessageAnnotation } from "~/types";

interface ChatProps {
  userName: string;
  isAuthenticated: boolean;
  chatId: string;
  isNewChat: boolean;
  initialMessages?: Message[];
}

interface UsageStats {
  totalRequests: number;
  searchGroundingRequests: number;
  externalToolRequests: number;
  limit: number;
  isAdmin: boolean;
}

// Debounced input handler to reduce re-renders
const useDebouncedInput = (delay: number = 100) => {
  const [debouncedValue, setDebouncedValue] = useState("");
  const [immediateValue, setImmediateValue] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(immediateValue);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [immediateValue, delay]);

  return [immediateValue, setImmediateValue, debouncedValue] as const;
};

// Memoized usage stats component
const UsageStatsDisplay = memo(({ usageStats }: { usageStats: UsageStats }) => {
  const isNearLimit = !usageStats.isAdmin
    ? usageStats.totalRequests >= usageStats.limit * 0.8
    : false;
  const isAtLimit = !usageStats.isAdmin
    ? usageStats.totalRequests >= usageStats.limit
    : false;

  return (
    <div className="border-b border-gray-700 bg-gray-800 p-3">
      <div className="mx-auto max-w-[65ch]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            {usageStats.isAdmin ? (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-purple-300">👑 Admin</span>
                <span className="text-gray-300">
                  Today's Usage: {usageStats.totalRequests} (Unlimited)
                </span>
              </div>
            ) : (
              <span className="text-gray-300">
                Today's Usage: {usageStats.totalRequests}/{usageStats.limit}
              </span>
            )}
            <span className="text-gray-400">
              ({usageStats.searchGroundingRequests} search grounding,{" "}
              {usageStats.externalToolRequests} external tool)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {usageStats.isAdmin && (
              <div className="flex items-center gap-1 text-purple-400">
                <span className="text-xs">Unlimited access</span>
              </div>
            )}
            {!usageStats.isAdmin && isAtLimit && (
              <div className="flex items-center gap-1 text-red-400">
                <AlertTriangle className="size-4" />
                <span className="text-xs">Limit reached</span>
              </div>
            )}
            {!usageStats.isAdmin && isNearLimit && !isAtLimit && (
              <div className="flex items-center gap-1 text-yellow-400">
                <AlertTriangle className="size-4" />
                <span className="text-xs">Near limit</span>
              </div>
            )}
            {isTavilyLimitExceeded() && (
              <div className="flex items-center gap-1 text-orange-400">
                <WifiOff className="size-4" />
                <span className="text-xs">Manual search mode</span>
              </div>
            )}
          </div>
        </div>
        {/* Progress bar - only show for non-admin users */}
        {!usageStats.isAdmin && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-700">
            <div
              className={`h-full transition-all duration-300 ${
                isAtLimit
                  ? "bg-red-500"
                  : isNearLimit
                    ? "bg-yellow-500"
                    : "bg-green-500"
              }`}
              style={{
                width: `${Math.min((usageStats.totalRequests / usageStats.limit) * 100, 100)}%`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
});

UsageStatsDisplay.displayName = "UsageStatsDisplay";

// Memoized chat input component
const ChatInput = memo(
  ({
    input,
    onInputChange,
    onSubmit,
    isLoading,
    chatLoading,
    isAtLimit,
    isAdmin,
  }: {
    input: string;
    onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSubmit: (e: React.FormEvent) => void;
    isLoading: boolean;
    chatLoading: boolean;
    isAtLimit: boolean;
    isAdmin: boolean;
  }) => {
    const placeholder = useMemo(() => {
      if (!isAdmin && isAtLimit) return "Daily limit reached";
      if (chatLoading) return "AI is working on your request...";
      return "Ask me anything - I'll search the web for you!";
    }, [isAdmin, isAtLimit, chatLoading]);

    const isDisabled = isLoading || chatLoading || (!isAdmin && isAtLimit);

    // No complex loading logic - just let the button show loading state

    return (
      <form onSubmit={onSubmit} className="mx-auto max-w-[65ch] p-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={onInputChange}
            placeholder={placeholder}
            autoFocus
            aria-label="Chat input"
            className="flex-1 rounded border border-gray-700 bg-gray-800 p-2 text-gray-200 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
            disabled={isDisabled}
          />
          <button
            type="submit"
            disabled={isDisabled}
            className={`rounded px-4 py-2 text-white transition-all duration-200 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
              isDisabled
                ? "cursor-not-allowed bg-gray-700 opacity-50"
                : "bg-blue-600 hover:bg-blue-500 active:scale-95"
            }`}
          >
            {isLoading || chatLoading ? (
              <div className="flex items-center gap-2">
                <Square className="size-4 animate-spin" />
                <span className="text-sm">Working...</span>
              </div>
            ) : (
              "Send"
            )}
          </button>
        </div>
      </form>
    );
  },
);

ChatInput.displayName = "ChatInput";

export const ChatPage = ({
  userName,
  isAuthenticated,
  chatId,
  isNewChat,
  initialMessages,
}: ChatProps) => {
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading: chatLoading,
    data,
    append,
  } = useChat({
    api: "/api/chat",
    body: {
      chatId,
      isNewChat,
    },
    initialMessages,
    onError: (error) => {
      if (error.message?.includes("Rate limit exceeded")) {
        // Refresh usage stats when rate limit is hit
        fetchUsageStats();
      }
    },
  });

  const fetchUsageStats = useCallback(async () => {
    try {
      const response = await fetch("/api/usage");
      if (response.ok) {
        const stats = await response.json();
        setUsageStats(stats);
      }
    } catch (error) {
      console.error("Failed to fetch usage stats:", error);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUsageStats();
    }
  }, [isAuthenticated, fetchUsageStats]);

  // Handle new chat creation redirect
  useEffect(() => {
    const lastDataItem = data?.[data.length - 1];

    if (lastDataItem && isNewChatCreated(lastDataItem)) {
      router.push(`?id=${lastDataItem.chatId}`);
    }
  }, [data, router]);

  const handleSubmitWithUsage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      setIsLoading(true);

      try {
        await handleSubmit(e);
        // Refresh usage stats after successful request
        setTimeout(fetchUsageStats, 1000);
      } finally {
        setIsLoading(false);
      }
    },
    [handleSubmit, fetchUsageStats],
  );

  const handleInputChangeOptimized = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleInputChange(e);
    },
    [handleInputChange],
  );

  // Memoize computed values
  const isAtLimit = useMemo(
    () =>
      usageStats && !usageStats.isAdmin
        ? usageStats.totalRequests >= usageStats.limit
        : false,
    [usageStats],
  );

  const isAdmin = useMemo(() => usageStats?.isAdmin ?? false, [usageStats]);

  const maxHeight = useMemo(
    () => (usageStats ? "213px" : "185px"),
    [usageStats],
  );

  if (!isAuthenticated) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-gray-200">
            Sign in to start chatting
          </h2>
          <p className="text-gray-400">
            You need to be logged in to use the chat feature.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Usage Stats */}
      {usageStats && <UsageStatsDisplay usageStats={usageStats} />}

      <StickToBottom
        className={`relative mx-auto overflow-hidden max-h-[calc(100%-${maxHeight})] w-full max-w-[65ch] flex-1 p-4 [&>div]:scrollbar-thin [&>div]:scrollbar-track-gray-800 [&>div]:scrollbar-thumb-gray-600 [&>div]:hover:scrollbar-thumb-gray-500`}
        resize="smooth"
        initial="smooth"
      >
        <StickToBottom.Content
          className="overflow-y-auto p-4"
          role="log"
          aria-label="Chat messages"
        >
          {messages.map((message, index) => {
            return (
              <ChatMessage
                key={`${message.id || index}-${message.role}`}
                parts={message.parts ?? []}
                role={message.role}
                userName={userName}
                annotations={
                  (message.annotations ??
                    []) as unknown as OurMessageAnnotation[]
                }
              />
            );
          })}
        </StickToBottom.Content>
      </StickToBottom>

      <div className="relative border-t border-gray-700">
        <ChatInput
          input={input}
          onInputChange={handleInputChangeOptimized}
          onSubmit={handleSubmitWithUsage}
          isLoading={isLoading}
          chatLoading={chatLoading}
          isAtLimit={isAtLimit}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
};
