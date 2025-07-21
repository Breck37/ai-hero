"use client";

import Link from "next/link";
import { DeleteChatButton } from "./delete-chat-button";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Chat {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ChatListProps {
  chats: Chat[];
  currentChatId?: string;
  isAuthenticated: boolean;
}

export function ChatList({
  chats: initialChats,
  currentChatId,
  isAuthenticated,
}: ChatListProps) {
  const [chats, setChats] = useState(initialChats);
  const router = useRouter();

  const handleDelete = (deletedChatId: string) => {
    // Remove the chat from the local state
    setChats((prevChats) =>
      prevChats.filter((chat) => chat.id !== deletedChatId),
    );

    // If the deleted chat was the current chat, redirect to home
    if (deletedChatId === currentChatId) {
      router.push("/");
    }
  };

  if (!isAuthenticated) {
    return <p className="text-sm text-gray-500">Sign in to start chatting</p>;
  }

  if (chats.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No chats yet. Start a new conversation!
      </p>
    );
  }

  return (
    <>
      {chats.map((chat) => (
        <div key={chat.id} className="flex items-center gap-2">
          <Link
            href={`/?id=${chat.id}`}
            className={`flex flex-1 items-center justify-between rounded-lg p-3 text-left text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
              chat.id === currentChatId
                ? "bg-gray-700"
                : "hover:bg-gray-750 bg-gray-800"
            }`}
          >
            {chat.title}
            <DeleteChatButton
              chatId={chat.id}
              onDelete={() => handleDelete(chat.id)}
            />
          </Link>
        </div>
      ))}
    </>
  );
}
