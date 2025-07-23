"use client";

import { ChatMessage } from "~/components/chat-message";
import { useChat } from "@ai-sdk/react";
import { Square, Search, Globe } from "lucide-react";
import { useState } from "react";

interface ChatProps {
  userName: string;
  isAuthenticated: boolean;
}

export const ChatPage = ({ userName, isAuthenticated }: ChatProps) => {
  const [useSearchGrounding, setUseSearchGrounding] = useState(false);

  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: "/api/chat",
      body: {
        useSearchGrounding,
      },
    });

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
        <form onSubmit={handleSubmit} className="mx-auto max-w-[65ch] p-4">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Say something..."
              autoFocus
              aria-label="Chat input"
              className="flex-1 rounded border border-gray-700 bg-gray-800 p-2 text-gray-200 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="rounded bg-gray-700 px-4 py-2 text-white hover:bg-gray-600 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:hover:bg-gray-700"
            >
              {isLoading ? <Square className="size-4 animate-spin" /> : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
