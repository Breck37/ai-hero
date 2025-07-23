"use client";

import { ChatMessage } from "~/components/chat-message";
import { SignInModal } from "~/components/sign-in-modal";
import { ModelSwitcher } from "~/components/model-switcher";
import { useChat } from "@ai-sdk/react";
import { Square } from "lucide-react";
import { ErrorMessage } from "~/components/error-message";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { StickToBottom } from "use-stick-to-bottom";

interface ChatProps {
  userName: string;
  isAuthenticated: boolean;
  chatId: string;
  isNewChat: boolean;
  initialMessages?: import("ai").Message[];
}

// Utility type guard for NEW_CHAT_CREATED event
function isNewChatCreated(
  data: unknown,
): data is { type: "NEW_CHAT_CREATED"; chatId: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    (data as any).type === "NEW_CHAT_CREATED" &&
    "chatId" in data &&
    typeof (data as any).chatId === "string"
  );
}

export const ChatPage = ({
  userName,
  isAuthenticated,
  chatId,
  isNewChat,
  initialMessages,
}: ChatProps) => {
  const [selectedModel, setSelectedModel] = useState<{
    provider: string;
    model: string;
  } | null>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    error,
    reload,
    data,
  } = useChat({
    body: {
      chatId,
      isNewChat,
      modelProvider: selectedModel?.provider,
      modelName: selectedModel?.model,
    },
    initialMessages,
  });

  const isLoading = status === "streaming" || status === "submitted";
  const hasRedirected = useRef(false);

  // Listen for NEW_CHAT_CREATED event and update URL
  const router = useRouter();
  useEffect(() => {
    const lastDataItem = data?.[data.length - 1];
    if (
      lastDataItem &&
      isNewChatCreated(lastDataItem) &&
      !hasRedirected.current
    ) {
      console.log("New chat created, updating URL:", lastDataItem.chatId);
      hasRedirected.current = true;

      // Update URL without causing a component re-render by directly manipulating history
      const newUrl = `${window.location.pathname}?id=${lastDataItem.chatId}`;
      window.history.replaceState({}, "", newUrl);
    }
  }, [data, router]);

  const handleModelChange = (provider: string, model: string) => {
    setSelectedModel({ provider, model });
  };

  return (
    <>
      <div className="flex flex-1 flex-col">
        {/* Model Switcher Header */}
        <div className="border-b border-gray-700 bg-gray-900 p-3">
          <div className="mx-auto flex max-w-[65ch] items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-200">AI Chat</h1>
            <ModelSwitcher
              onModelChange={handleModelChange}
              currentModel={selectedModel || undefined}
              disabled={isLoading}
            />
          </div>
        </div>

        <StickToBottom
          className="relative mx-auto max-h-[calc(100%-140px)] w-full max-w-[65ch] flex-1 p-4 [&>div]:scrollbar-thin [&>div]:scrollbar-track-gray-800 [&>div]:scrollbar-thumb-gray-600 [&>div]:hover:scrollbar-thumb-gray-500"
          resize="smooth"
          initial="smooth"
        >
          <StickToBottom.Content
            className="flex flex-col gap-4 overflow-y-auto"
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
          </StickToBottom.Content>
        </StickToBottom>

        <div className="relative border-t border-gray-700 bg-gray-900">
          {/* Error message display - absolutely positioned above input */}
          {error && (
            <div className="absolute bottom-full left-0 right-0 z-10 p-4">
              <div className="mx-auto max-w-[65ch]">
                <ErrorMessage
                  message={
                    typeof error === "string"
                      ? error
                      : error.message || "An error occurred."
                  }
                />
                <button
                  type="button"
                  onClick={() => reload()}
                  className="mt-2 rounded bg-gray-700 px-4 py-2 text-white hover:bg-gray-600 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit} className="mx-auto max-w-[65ch] p-4">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Say something..."
                autoFocus
                aria-label="Chat input"
                className="flex-1 rounded border border-gray-700 bg-gray-800 p-2 text-gray-200 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                disabled={isLoading || !isAuthenticated || !!error}
              />
              <button
                type="submit"
                disabled={isLoading || !isAuthenticated || !!error}
                className="rounded bg-gray-700 px-4 py-2 text-white hover:bg-gray-600 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:hover:bg-gray-700"
              >
                {isLoading ? (
                  <Square className="size-4 animate-spin" />
                ) : (
                  "Send"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <SignInModal isOpen={!isAuthenticated} onClose={() => {}} />
    </>
  );
};
