import type { Message } from "ai";
import { and, count, eq, gte, desc, asc } from "drizzle-orm";
import { db } from "./index";
import { userRequests, users, chats, messages, errors } from "./schema";

// Rate limit configuration
export const DAILY_RATE_LIMIT = 50; // requests per day

/**
 * Check if a user has exceeded their daily rate limit
 */
export async function checkRateLimit(userId: string): Promise<{
  allowed: boolean;
  currentCount: number;
  limit: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await db
    .select({ count: count() })
    .from(userRequests)
    .where(
      and(eq(userRequests.userId, userId), gte(userRequests.createdAt, today)),
    );

  const currentCount = result[0]?.count ?? 0;
  const allowed = currentCount < DAILY_RATE_LIMIT;

  return {
    allowed,
    currentCount,
    limit: DAILY_RATE_LIMIT,
  };
}

/**
 * Record a new request for a user
 */
export async function recordRequest(
  userId: string,
  requestType: string,
  useSearchGrounding: boolean,
): Promise<void> {
  await db.insert(userRequests).values({
    userId,
    requestType,
    useSearchGrounding,
  });
}

/**
 * Check if a user is an admin
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const result = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result[0]?.isAdmin ?? false;
}

/**
 * Get user's request statistics for today
 */
export async function getUserRequestStats(userId: string): Promise<{
  totalRequests: number;
  searchGroundingRequests: number;
  externalToolRequests: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await db
    .select({
      totalRequests: count(),
      searchGroundingRequests: count(),
      externalToolRequests: count(),
    })
    .from(userRequests)
    .where(
      and(eq(userRequests.userId, userId), gte(userRequests.createdAt, today)),
    );

  const searchGroundingResult = await db
    .select({ count: count() })
    .from(userRequests)
    .where(
      and(
        eq(userRequests.userId, userId),
        gte(userRequests.createdAt, today),
        eq(userRequests.useSearchGrounding, true),
      ),
    );

  const externalToolResult = await db
    .select({ count: count() })
    .from(userRequests)
    .where(
      and(
        eq(userRequests.userId, userId),
        gte(userRequests.createdAt, today),
        eq(userRequests.useSearchGrounding, false),
      ),
    );

  return {
    totalRequests: result[0]?.totalRequests ?? 0,
    searchGroundingRequests: searchGroundingResult[0]?.count ?? 0,
    externalToolRequests: externalToolResult[0]?.count ?? 0,
  };
}

/**
 * Upsert a chat with all its messages
 * If the chat exists, it will delete all existing messages and replace them with the new ones
 * If the chat doesn't exist, it will create a new chat
 */
export async function upsertChat(opts: {
  userId: string;
  chatId: string;
  title?: string;
  useSearchGrounding?: boolean;
  useTavily?: boolean;
  messages: Message[];
}) {
  const {
    userId,
    chatId,
    title,
    useSearchGrounding,
    useTavily,
    messages: messageList,
  } = opts;

  // Check if the chat exists and belongs to the user
  const existingChat = await db
    .select({ id: chats.id, title: chats.title })
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .limit(1);

  if (existingChat.length > 0) {
    // Chat exists - delete all existing messages and replace them
    await db.delete(messages).where(eq(messages.chatId, chatId));

    // Update the chat title and timestamp (only if title is provided AND current title is "Generating..." or empty)
    const updateData: {
      updatedAt: Date;
      title?: string;
      useSearchGrounding?: boolean;
      useTavily?: boolean;
    } = {
      updatedAt: new Date(),
    };

    const currentTitle = existingChat[0]?.title;
    const shouldUpdateTitle =
      title &&
      title.trim() &&
      (currentTitle === "Generating..." ||
        currentTitle === "New Chat" ||
        !currentTitle ||
        currentTitle.trim() === "");

    if (shouldUpdateTitle) {
      // Only update title if current title is "Generating..." or if no proper title exists
      updateData.title = title.trim();
    }

    if (useSearchGrounding !== undefined) {
      updateData.useSearchGrounding = useSearchGrounding;
    }

    if (useTavily !== undefined) {
      updateData.useTavily = useTavily;
    }

    await db.update(chats).set(updateData).where(eq(chats.id, chatId));
  } else {
    // Chat doesn't exist - create a new chat
    await db.insert(chats).values({
      id: chatId,
      userId,
      // Store titles as-is for clean UI display
      title: title || "New Chat",
      useSearchGrounding: useSearchGrounding ?? false,
      useTavily: useTavily ?? true, // Default to Tavily
    });
  }

  // Insert all messages WITHOUT sanitization (preserve original content for UI)
  // Only insert messages if we have them (not just updating settings)
  if (messageList.length > 0) {
    const messageValues = messageList.map((message, index) => {
      // Ensure we always have proper parts, but don't sanitize content
      let messageParts;
      if (message.parts && Array.isArray(message.parts)) {
        messageParts = message.parts;
      } else if (message.content) {
        messageParts = [{ type: "text", text: message.content }];
      } else {
        messageParts = [{ type: "text", text: "" }];
      }

      return {
        chatId,
        role: message.role,
        parts: messageParts,
        annotations: message.annotations || null,
        order: index,
      };
    });

    await db.insert(messages).values(messageValues);
  }
}

/**
 * Get a chat by id with its messages
 */
export async function getChat(chatId: string, userId: string) {
  // First verify the chat belongs to the user
  const chat = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .limit(1);

  if (chat.length === 0) {
    return null;
  }

  // Get all messages for this chat, ordered by their order field
  const messageList = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.order));

  // Convert messages back to the AI SDK format
  const aiMessages: Message[] = messageList.map((msg) => {
    // Ensure parts is always an array
    let messageParts;
    if (msg.parts && Array.isArray(msg.parts)) {
      messageParts = msg.parts;
    } else if (typeof msg.parts === "string") {
      // If parts is a string, treat it as text content
      messageParts = [{ type: "text", text: msg.parts }];
    } else {
      // Fallback for malformed data
      messageParts = [{ type: "text", text: "Message content unavailable" }];
    }

    return {
      id: msg.id,
      role: msg.role as "user" | "assistant",
      parts: messageParts,
      annotations: Array.isArray(msg.annotations) ? msg.annotations : undefined,
      content: "",
    };
  });

  return {
    ...chat[0],
    messages: aiMessages,
  };
}

/**
 * Get all chats for a user, without the messages
 */
export async function getChats(userId: string) {
  const chatList = await db
    .select()
    .from(chats)
    .where(eq(chats.userId, userId))
    .orderBy(desc(chats.updatedAt));

  return chatList;
}

/**
 * Record an error to the database
 */
export async function recordError(opts: {
  chatId?: string;
  userId?: string;
  langfuseTraceId?: string;
  errorType: string;
  errorMessage: string;
  errorStack?: string;
  context?: Record<string, any>;
}): Promise<void> {
  await db.insert(errors).values({
    chatId: opts.chatId,
    userId: opts.userId,
    langfuseTraceId: opts.langfuseTraceId,
    errorType: opts.errorType,
    errorMessage: opts.errorMessage,
    errorStack: opts.errorStack,
    context: opts.context,
  });
}

/**
 * Get errors for a specific chat
 */
export async function getChatErrors(chatId: string) {
  return await db
    .select()
    .from(errors)
    .where(eq(errors.chatId, chatId))
    .orderBy(desc(errors.createdAt));
}

/**
 * Get recent errors for a user
 */
export async function getUserErrors(userId: string, limit: number = 10) {
  return await db
    .select()
    .from(errors)
    .where(eq(errors.userId, userId))
    .orderBy(desc(errors.createdAt))
    .limit(limit);
}
