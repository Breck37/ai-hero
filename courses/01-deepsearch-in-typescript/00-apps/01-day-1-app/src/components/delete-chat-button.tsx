"use client";

import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface DeleteChatButtonProps {
  chatId: string;
  onDelete: () => void;
  className?: string;
}

export function DeleteChatButton({
  chatId,
  onDelete,
  className = "",
}: DeleteChatButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (isDeleting) return;

    // Show confirmation dialog
    const confirmed = window.confirm(
      "Are you sure you want to delete this chat? This action cannot be undone.",
    );
    if (!confirmed) return;

    setIsDeleting(true);

    try {
      const response = await fetch("/api/chat/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chatId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete chat");
      }

      toast.success("Chat deleted successfully");
      onDelete();
    } catch (error) {
      console.error("Error deleting chat:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete chat",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className={`flex size-6 items-center justify-center rounded text-gray-400 hover:bg-red-400/10 hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      title="Delete chat"
    >
      <Trash2Icon className="size-4" />
    </button>
  );
}
