"use client";

import { ChatMessage } from "~/components/chat-message";
import { useChat } from "@ai-sdk/react";
import { Square, Search, Globe, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";

interface ChatProps {
  userName: string;
  isAuthenticated: boolean;
}

interface UsageStats {
  totalRequests: number;
  searchGroundingRequests: number;
  externalToolRequests: number;
  limit: number;
  isAdmin: boolean;
}

export const ChatPage = ({ userName, isAuthenticated }: ChatProps) => {
  const [useSearchGrounding, setUseSearchGrounding] = useState(false);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading: chatLoading,
  } = useChat({
    api: "/api/chat",
    body: {
      useSearchGrounding,
    },
    onError: (error) => {
      if (error.message?.includes("Rate limit exceeded")) {
        // Refresh usage stats when rate limit is hit
        fetchUsageStats();
      }
    },
  });

  const fetchUsageStats = async () => {
    try {
      const response = await fetch("/api/usage");
      if (response.ok) {
        const stats = await response.json();
        setUsageStats(stats);
      }
    } catch (error) {
      console.error("Failed to fetch usage stats:", error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchUsageStats();
    }
  }, [isAuthenticated]);

  const handleSubmitWithUsage = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await handleSubmit(e);
      // Refresh usage stats after successful request
      setTimeout(fetchUsageStats, 1000);
    } finally {
      setIsLoading(false);
    }
  };

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

  const isNearLimit =
    usageStats && !usageStats.isAdmin
      ? usageStats.totalRequests >= usageStats.limit * 0.8
      : false;
  const isAtLimit =
    usageStats && !usageStats.isAdmin
      ? usageStats.totalRequests >= usageStats.limit
      : false;

  return (
    <div className="flex flex-1 flex-col">
      {/* Search Mode Toggle */}
      <div className="border-b border-gray-700 bg-gray-900 p-4">
        <div className="mx-auto max-w-[65ch]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-300">
                Search Mode:
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUseSearchGrounding(false)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  !useSearchGrounding
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <Search className="size-4" />
                External Tool
              </button>
              <button
                onClick={() => setUseSearchGrounding(true)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  useSearchGrounding
                    ? "bg-purple-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <Globe className="size-4" />
                Search Grounding
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            {useSearchGrounding
              ? "Using native model search grounding (faster, less control)"
              : "Using external Serper search tool (more control, shows search process)"}
          </p>
        </div>
      </div>

      {/* Usage Stats */}
      {usageStats && (
        <div className="border-b border-gray-700 bg-gray-800 p-3">
          <div className="mx-auto max-w-[65ch]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                {usageStats.isAdmin ? (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-purple-300">
                      👑 Admin
                    </span>
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
      )}

      <div
        className="mx-auto w-full max-w-[65ch] flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500"
        role="log"
        aria-label="Chat messages"
      >
        {messages.map((message, index) => {
          return (
            <ChatMessage
              key={index}
              parts={message.parts ?? []}
              role={message.role}
              userName={userName}
            />
          );
        })}
      </div>

      <div className="border-t border-gray-700">
        <form
          onSubmit={handleSubmitWithUsage}
          className="mx-auto max-w-[65ch] p-4"
        >
          <div className="flex gap-2">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder={
                !usageStats?.isAdmin && isAtLimit
                  ? "Daily limit reached"
                  : "Say something..."
              }
              autoFocus
              aria-label="Chat input"
              className="flex-1 rounded border border-gray-700 bg-gray-800 p-2 text-gray-200 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
              disabled={
                isLoading || chatLoading || (!usageStats?.isAdmin && isAtLimit)
              }
            />
            <button
              type="submit"
              disabled={
                isLoading || chatLoading || (!usageStats?.isAdmin && isAtLimit)
              }
              className="rounded bg-gray-700 px-4 py-2 text-white hover:bg-gray-600 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:hover:bg-gray-700"
            >
              {isLoading || chatLoading ? (
                <Square className="size-4 animate-spin" />
              ) : (
                "Send"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
