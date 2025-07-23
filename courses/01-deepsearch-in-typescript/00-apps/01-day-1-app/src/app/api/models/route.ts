import { getAvailableModels } from "@/model";
import { auth } from "~/server/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const availableModels = getAvailableModels();
    return Response.json(availableModels);
  } catch (error) {
    console.error("Error fetching available models:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
