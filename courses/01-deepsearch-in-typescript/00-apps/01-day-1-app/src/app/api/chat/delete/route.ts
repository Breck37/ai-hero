import { auth } from "~/server/auth";
import { deleteChat } from "~/server/db/queries";
import { Langfuse } from "langfuse";
import { env } from "~/env";

const langfuse = new Langfuse({
  publicKey: env.LANGFUSE_PUBLIC_KEY,
  secretKey: env.LANGFUSE_SECRET_KEY,
  baseUrl: env.LANGFUSE_BASEURL,
});

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Create Langfuse trace
  const trace = langfuse.trace({
    name: "delete-chat",
    userId: session.user.id,
  });

  try {
    const { chatId } = await request.json();

    if (!chatId) {
      return new Response("Chat ID is required", { status: 400 });
    }

    const deleteSpan = trace.span({
      name: "delete-chat-operation",
      input: { chatId, userId: session.user.id },
    });

    await deleteChat({
      userId: session.user.id,
      chatId,
      trace,
    });

    deleteSpan.end({
      output: { success: true },
    });

    // Flush the trace to Langfuse
    await langfuse.flushAsync();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorSpan = trace.span({
      name: "delete-chat-error",
      input: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    errorSpan.end({
      output: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    // Flush the trace to Langfuse
    await langfuse.flushAsync();

    console.error("Error deleting chat:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to delete chat",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
