import { db } from "~/server/db";
import { userRequests, users } from "~/server/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export async function checkAndRecordRateLimit({
  db,
  userId,
  endpoint = "chat",
  isAdmin,
  maxRequestsPerDay = 100,
  trace,
}: {
  db: typeof import("~/server/db").db;
  userId: string;
  endpoint?: string;
  isAdmin: boolean;
  maxRequestsPerDay?: number;
  trace?: any; // Langfuse trace object for spans
}): Promise<{ allowed: boolean; error: string | null }> {
  if (isAdmin) {
    // Admins bypass rate limit, but still record the request
    const adminRecordSpan = trace?.span({
      name: "record-admin-request",
      input: { userId, endpoint },
    });

    await db.insert(userRequests).values({
      userId,
      endpoint,
      requestedAt: new Date(),
    });

    adminRecordSpan?.end({
      output: { success: true, bypassed: true },
    });

    return { allowed: true, error: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const checkRequestsSpan = trace?.span({
    name: "check-existing-requests",
    input: {
      userId,
      endpoint,
      today: today.toISOString(),
      tomorrow: tomorrow.toISOString(),
    },
  });

  const requestsToday = await db.query.userRequests.findMany({
    where: and(
      eq(userRequests.userId, userId),
      gte(userRequests.requestedAt, today),
      lte(userRequests.requestedAt, tomorrow),
      eq(userRequests.endpoint, endpoint),
    ),
  });

  checkRequestsSpan?.end({
    output: {
      requestCount: requestsToday.length,
      maxAllowed: maxRequestsPerDay,
    },
  });

  if (requestsToday.length >= maxRequestsPerDay) {
    return { allowed: false, error: "Rate limit exceeded" };
  }

  const recordRequestSpan = trace?.span({
    name: "record-user-request",
    input: { userId, endpoint },
  });

  await db.insert(userRequests).values({
    userId,
    endpoint,
    requestedAt: new Date(),
  });

  recordRequestSpan?.end({
    output: { success: true },
  });

  return { allowed: true, error: null };
}
