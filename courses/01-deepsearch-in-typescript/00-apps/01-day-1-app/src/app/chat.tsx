"use client";

import { ChatMessage } from "~/components/chat-message";
import { SignInModal } from "~/components/sign-in-modal";
import { useChat } from "@ai-sdk/react";
import { Square } from "lucide-react";
import { ErrorMessage } from "~/components/error-message";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ChatProps {
  userName: string;
  isAuthenticated: boolean;
  chatId: string | undefined;
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

export const ChatPage = ({ userName, isAuthenticated, chatId }: ChatProps) => {
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
    body: { chatId },
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Listen for NEW_CHAT_CREATED event and redirect
  const router = useRouter();
  useEffect(() => {
    const lastDataItem = data?.[data.length - 1];
    if (lastDataItem && isNewChatCreated(lastDataItem)) {
      router.push(`?id=${lastDataItem.chatId}`);
    }
  }, [data, router]);

  return (
    <>
      <div className="flex flex-1 flex-col">
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

        {/* Error message display */}
        {error && (
          <div className="mb-2">
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
        )}

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
