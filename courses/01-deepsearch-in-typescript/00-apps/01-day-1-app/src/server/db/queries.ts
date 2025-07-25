import { and, count, eq, gte, desc, asc } from "drizzle-orm";
import { db } from "./index";
import { userRequests, users, chats, messages, errors } from "./schema";
import type { Message } from "ai";
import { cleanJsonContent, sanitizeForJson } from "~/utils";

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
 * Safely sanitizes a message part to prevent JSON corruption
 */
function sanitizeMessagePart(part: any): any {
  if (!part || typeof part !== "object") {
    return part;
  }

  if (part.type === "text" && typeof part.text === "string") {
    return {
      ...part,
      text: cleanJsonContent(part.text),
    };
  }

  // For other part types, sanitize any string properties
  const sanitized = { ...part };
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeForJson(value);
    }
  }

  return sanitized;
}

/**
 * Safely sanitizes message content before storage
 */
function sanitizeMessage(message: Message): Message {
  const sanitized = { ...message };

  // Sanitize content if it exists
  if (sanitized.content && typeof sanitized.content === "string") {
    sanitized.content = cleanJsonContent(sanitized.content);
  }

  // Sanitize parts if they exist
  if (sanitized.parts && Array.isArray(sanitized.parts)) {
    sanitized.parts = sanitized.parts.map(sanitizeMessagePart);
  }

  // Sanitize annotations if they exist
  if (sanitized.annotations && Array.isArray(sanitized.annotations)) {
    sanitized.annotations = sanitized.annotations.map((annotation) => {
      if (typeof annotation === "object" && annotation !== null) {
        const sanitizedAnnotation: any = { ...annotation };
        for (const [key, value] of Object.entries(sanitizedAnnotation)) {
          if (typeof value === "string") {
            sanitizedAnnotation[key] = sanitizeForJson(value);
          }
        }
        return sanitizedAnnotation;
      }
      return annotation;
    });
  }

  return sanitized;
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
  messages: Message[];
}) {
  const { userId, chatId, title, messages: messageList } = opts;

  // Check if the chat exists and belongs to the user
  const existingChat = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .limit(1);

  if (existingChat.length > 0) {
    // Chat exists - delete all existing messages and replace them
    await db.delete(messages).where(eq(messages.chatId, chatId));

    // Update the chat title and timestamp (only if title is provided)
    const updateData: { updatedAt: Date; title?: string } = {
      updatedAt: new Date(),
    };

    if (title) {
      updateData.title = sanitizeForJson(title);
    }

    await db.update(chats).set(updateData).where(eq(chats.id, chatId));
  } else {
    // Chat doesn't exist - create a new chat
    await db.insert(chats).values({
      id: chatId,
      userId,
      title: title ? sanitizeForJson(title) : "New Chat",
    });
  }

  // Insert all messages with sanitization
  if (messageList.length > 0) {
    const messageValues = messageList.map((message, index) => {
      // Sanitize the entire message
      const sanitizedMessage = sanitizeMessage(message);

      // Ensure we always have proper parts
      let messageParts;
      if (sanitizedMessage.parts && Array.isArray(sanitizedMessage.parts)) {
        messageParts = sanitizedMessage.parts;
      } else if (sanitizedMessage.content) {
        messageParts = [{ type: "text", text: sanitizedMessage.content }];
      } else {
        messageParts = [{ type: "text", text: "" }];
      }

      return {
        chatId,
        role: sanitizedMessage.role,
        parts: messageParts,
        annotations: sanitizedMessage.annotations || null,
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
