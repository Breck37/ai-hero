import { db } from "~/server/db";
import { chats, messages } from "./schema";
import { eq, and, asc, desc } from "drizzle-orm";
import type { Message as AIMessage } from "ai";

export const upsertChat = async (opts: {
  userId: string;
  chatId: string;
  title: string;
  messages: Array<{ role: string; parts: any[]; order: number }>;
}) => {
  // Check if chat exists
  const existingChat = await db.query.chats.findFirst({
    where: eq(chats.id, opts.chatId),
  });
  if (existingChat && existingChat.userId !== opts.userId) {
    throw new Error("Chat ID already exists for a different user");
  }
  // Check if chat exists and belongs to user
  const chat =
    existingChat && existingChat.userId === opts.userId ? existingChat : null;
  if (chat) {
    // Delete all existing messages for this chat
    await db.delete(messages).where(eq(messages.chatId, opts.chatId));
    // Insert new messages
    await db.insert(messages).values(
      opts.messages.map((m, i) => ({
        chatId: opts.chatId,
        role: m.role,
        parts: m.parts,
        order: i,
      })),
    );
    // Update chat title and updatedAt if needed
    await db
      .update(chats)
      .set({ title: opts.title, updatedAt: new Date() })
      .where(eq(chats.id, opts.chatId));
    return;
  }
  // Create new chat
  await db.insert(chats).values({
    id: opts.chatId,
    userId: opts.userId,
    title: opts.title,
  });
  await db.insert(messages).values(
    opts.messages.map((m, i) => ({
      chatId: opts.chatId,
      role: m.role,
      parts: m.parts,
      order: i,
    })),
  );
};

export const getChat = async (opts: { userId: string; chatId: string }) => {
  // Get chat and its messages (ordered)
  const chat = await db.query.chats.findFirst({
    where: and(eq(chats.id, opts.chatId), eq(chats.userId, opts.userId)),
  });
  if (!chat) return null;
  const msgs = await db.query.messages.findMany({
    where: eq(messages.chatId, opts.chatId),
    orderBy: asc(messages.order),
  });
  return { ...chat, messages: msgs };
};

export const getChats = async (opts: { userId: string }) => {
  // Get all chats for user, no messages
  return db.query.chats.findMany({
    where: eq(chats.userId, opts.userId),
    orderBy: [desc(chats.updatedAt)],
  });
};
