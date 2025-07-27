"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { AuthButton } from "./auth-button";
import { ChatCard } from "./chat-card";
import type { DB } from "~/server/db/schema";

interface SidebarProps {
  chats: DB.Chat[];
  activeChatId?: string;
  isAuthenticated: boolean;
  userImage?: string | null;
}

export const Sidebar = ({
  chats,
  activeChatId,
  isAuthenticated,
  userImage,
}: SidebarProps) => {
  const handleUpdateSettings = async (
    chatId: string,
    useSearchGrounding: boolean,
    useTavily: boolean,
  ) => {
    try {
      const response = await fetch("/api/chat/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId,
          useSearchGrounding,
          useTavily,
        }),
      });

      if (!response.ok) {
        console.error("Failed to update chat settings");
      }
    } catch (error) {
      console.error("Error updating chat settings:", error);
    }
  };

  return (
    <div className="flex w-64 flex-col border-r border-gray-700 bg-gray-900">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-400">Your Chats</h2>
          {isAuthenticated && (
            <Link
              href="/"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              title="New Chat"
            >
              <PlusIcon className="h-5 w-5" />
            </Link>
          )}
        </div>
      </div>
      <div className="-mt-1 flex-1 space-y-2 overflow-y-auto px-4 pt-1 scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600">
        {chats.length > 0 ? (
          chats.map((chat) => (
            <ChatCard
              key={chat.id}
              chat={chat}
              isActive={chat.id === activeChatId}
              onUpdateSettings={handleUpdateSettings}
            />
          ))
        ) : (
          <p className="text-sm text-gray-500">
            {isAuthenticated
              ? "No chats yet. Start a new conversation!"
              : "Sign in to start chatting"}
          </p>
        )}
      </div>
      <div className="p-4">
        <AuthButton isAuthenticated={isAuthenticated} userImage={userImage} />
      </div>
    </div>
  );
};
