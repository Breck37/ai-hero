import { auth } from "~/server/auth";
import {
  getUserRequestStats,
  DAILY_RATE_LIMIT,
  isUserAdmin,
} from "~/server/db/queries";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const stats = await getUserRequestStats(session.user.id);
    const adminStatus = await isUserAdmin(session.user.id);

    return Response.json({
      totalRequests: stats.totalRequests,
      searchGroundingRequests: stats.searchGroundingRequests,
      externalToolRequests: stats.externalToolRequests,
      limit: DAILY_RATE_LIMIT,
      isAdmin: adminStatus,
    });
  } catch (error) {
    console.error("Failed to get usage stats:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
