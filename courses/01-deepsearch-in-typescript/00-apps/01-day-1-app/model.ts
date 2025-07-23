import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { mistral } from "@ai-sdk/mistral";
import { env } from "~/env";

// Available models for each provider
export const models = {
  google: {
    "gemini-2.0-flash-001": google("gemini-2.0-flash-001"),
    "gemini-1.5-flash": google("gemini-1.5-flash"),
    "gemini-2.5-flash-lite-preview-06-17": google(
      "gemini-2.5-flash-lite-preview-06-17",
    ),
  },
  openai: {
    "gpt-4o": openai("gpt-4o"),
    "gpt-4o-mini": openai("gpt-4o-mini"),
    "gpt-4-turbo": openai("gpt-4-turbo"),
  },
  anthropic: {
    "claude-3-5-sonnet-20241022": anthropic("claude-3-5-sonnet-20241022"),
    "claude-3-5-haiku-20241022": anthropic("claude-3-5-haiku-20241022"),
    "claude-3-opus-20240229": anthropic("claude-3-opus-20240229"),
  },
  mistral: {
    "mistral-large-latest": mistral("mistral-large-latest"),
    "mistral-medium-latest": mistral("mistral-medium-latest"),
    "mistral-small-latest": mistral("mistral-small-latest"),
  },
};

// Function to get the current model based on environment variables
export function getCurrentModel() {
  // Check which API keys are available
  const availableProviders = {
    google: !!env.GOOGLE_GENERATIVE_AI_API_KEY,
    openai: !!env.OPENAI_API_KEY,
    anthropic: !!env.ANTHROPIC_API_KEY,
    mistral: !!env.MISTRAL_API_KEY,
  };

  // Active model: google - Gemini 2.0 Flash
  if (availableProviders.google) {
    return models.google["gemini-2.0-flash-001"];
  }

  // Priority order: Google (current default) -> OpenAI -> Anthropic -> Mistral
  if (availableProviders.google) {
    return models.google["gemini-2.0-flash-001"];
  }
  if (availableProviders.openai) {
    return models.openai["gpt-4o"];
  }
  if (availableProviders.anthropic) {
    return models.anthropic["claude-3-5-sonnet-20241022"];
  }
  if (availableProviders.mistral) {
    return models.mistral["mistral-large-latest"];
  }

  // Fallback to Google if no API keys are available
  console.warn("No API keys found, falling back to Google Gemini");
  return models.google["gemini-2.0-flash-001"];
}

// Export the current model as the default
export const model = getCurrentModel();

// Backup models for each provider
export const backupModels = {
  google: models.google["gemini-1.5-flash"],
  openai: models.openai["gpt-4o-mini"],
  anthropic: models.anthropic["claude-3-5-haiku-20241022"],
  mistral: models.mistral["mistral-medium-latest"],
};

// Function to get available models for the UI
export function getAvailableModels() {
  const available = [];

  if (env.GOOGLE_GENERATIVE_AI_API_KEY) {
    available.push(
      {
        provider: "google",
        name: "Gemini 2.0 Flash",
        model: "gemini-2.0-flash-001",
      },
      {
        provider: "google",
        name: "Gemini 1.5 Flash",
        model: "gemini-1.5-flash",
      },
      {
        provider: "google",
        name: "Gemini 2.5 Flash Lite",
        model: "gemini-2.5-flash-lite-preview-06-17",
      },
    );
  }

  if (env.OPENAI_API_KEY) {
    available.push(
      { provider: "openai", name: "GPT-4o", model: "gpt-4o" },
      { provider: "openai", name: "GPT-4o Mini", model: "gpt-4o-mini" },
      { provider: "openai", name: "GPT-4 Turbo", model: "gpt-4-turbo" },
    );
  }

  if (env.ANTHROPIC_API_KEY) {
    available.push(
      {
        provider: "anthropic",
        name: "Claude 3.5 Sonnet",
        model: "claude-3-5-sonnet-20241022",
      },
      {
        provider: "anthropic",
        name: "Claude 3.5 Haiku",
        model: "claude-3-5-haiku-20241022",
      },
      {
        provider: "anthropic",
        name: "Claude 3 Opus",
        model: "claude-3-opus-20240229",
      },
    );
  }

  if (env.MISTRAL_API_KEY) {
    available.push(
      {
        provider: "mistral",
        name: "Mistral Large",
        model: "mistral-large-latest",
      },
      {
        provider: "mistral",
        name: "Mistral Medium",
        model: "mistral-medium-latest",
      },
      {
        provider: "mistral",
        name: "Mistral Small",
        model: "mistral-small-latest",
      },
    );
  }

  return available;
}

// Function to get a specific model by provider and model name
export function getModel(provider: string, modelName: string) {
  const providerModels = models[provider as keyof typeof models];
  if (!providerModels) {
    throw new Error(`Provider ${provider} not supported`);
  }

  const model = providerModels[modelName as keyof typeof providerModels];
  if (!model) {
    throw new Error(`Model ${modelName} not found for provider ${provider}`);
  }

  return model;
}
