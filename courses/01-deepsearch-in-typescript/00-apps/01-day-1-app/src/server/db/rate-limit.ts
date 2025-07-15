import { db } from "~/server/db";
import { userRequests, users } from "~/server/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export async function checkAndRecordRateLimit({
  db,
  userId,
  endpoint = "chat",
  isAdmin,
  maxRequestsPerDay = 100,
}: {
  db: typeof import("~/server/db").db;
  userId: string;
  endpoint?: string;
  isAdmin: boolean;
  maxRequestsPerDay?: number;
}): Promise<{ allowed: boolean; error: string | null }> {
  if (isAdmin) {
    // Admins bypass rate limit, but still record the request
    await db.insert(userRequests).values({
      userId,
      endpoint,
      requestedAt: new Date(),
    });
    return { allowed: true, error: null };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const requestsToday = await db.query.userRequests.findMany({
    where: and(
      eq(userRequests.userId, userId),
      gte(userRequests.requestedAt, today),
      lte(userRequests.requestedAt, tomorrow),
      eq(userRequests.endpoint, endpoint),
    ),
  });
  if (requestsToday.length >= maxRequestsPerDay) {
    return { allowed: false, error: "Rate limit exceeded" };
  }
  await db.insert(userRequests).values({
    userId,
    endpoint,
    requestedAt: new Date(),
  });
  return { allowed: true, error: null };
}
