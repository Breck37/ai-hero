import { generateText } from "ai";
import { model } from "../model";
import type { Message } from "ai";

export const generateChatTitle = async (messages: Message[]) => {
  try {
    const { text } = await generateText({
      model,
      system: `You are a chat title generator.
        You will be given a chat history, and you will need to generate a title for the chat.
        The title should be a single sentence or title that captures the essence of the chat.
        The title should be no more than 50 characters.
        The title should be in the same language as the chat history.
        The title should be descriptive and meaningful.
        `,
      prompt: `Here is the chat history:

        ${messages.map((m) => m.content).join("\n")}
      `,
    });

    // Clean up the title
    const cleanTitle = text?.trim();
    if (
      !cleanTitle ||
      cleanTitle === "Generating..." ||
      cleanTitle.length > 50
    ) {
      return "New Chat";
    }

    return cleanTitle;
  } catch (error) {
    console.error("Error generating chat title:", error);
    return "New Chat";
  }
};
