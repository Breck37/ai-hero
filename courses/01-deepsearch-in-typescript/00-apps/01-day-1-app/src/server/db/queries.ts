import { and, count, eq, gte } from "drizzle-orm";
import { db } from "./index";
import { userRequests, users } from "./schema";

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
