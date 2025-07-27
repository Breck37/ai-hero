import { auth } from "~/server/auth/index.ts";
import { getChats, getChat } from "~/server/db/queries";
import { ChatPage } from "./chat.tsx";
import { Sidebar } from "../components/sidebar.tsx";
import type { Message } from "ai";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const session = await auth();
  const userName = session?.user?.name ?? "Guest";
  const isAuthenticated = !!session?.user;
  const { id: chatId } = await searchParams;

  // Fetch chats from database if user is authenticated
  const chats = isAuthenticated ? await getChats(session.user.id) : [];

  // Generate a stable chatId (either from URL or new UUID)
  const stableChatId = chatId || crypto.randomUUID();
  const isNewChat = !chatId;

  // Fetch the specific chat if chatId is provided
  let initialMessages: Message[] = [];
  if (chatId && isAuthenticated) {
    const chat = await getChat(chatId, session.user.id);
    if (chat) {
      initialMessages = chat.messages;
    }
  }

  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar
        chats={chats}
        activeChatId={chatId}
        isAuthenticated={isAuthenticated}
        userImage={session?.user?.image}
      />

      <ChatPage
        key={stableChatId}
        userName={userName}
        isAuthenticated={isAuthenticated}
        chatId={stableChatId}
        isNewChat={isNewChat}
        initialMessages={initialMessages}
      />
    </div>
  );
}
