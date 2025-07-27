import { auth } from "~/server/auth";
import { upsertChat } from "~/server/db/queries";

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as {
    chatId: string;
    useSearchGrounding: boolean;
    useTavily: boolean;
  };

  const { chatId, useSearchGrounding, useTavily } = body;

  try {
    // Update the chat settings without changing messages
    await upsertChat({
      userId: session.user.id,
      chatId,
      useSearchGrounding,
      useTavily,
      messages: [], // Empty array means we're only updating settings
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Failed to update chat settings:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update chat settings" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
}
