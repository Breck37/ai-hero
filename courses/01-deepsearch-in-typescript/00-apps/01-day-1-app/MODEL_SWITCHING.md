# AI Model Switching Guide

This project supports multiple AI providers and models. You can easily switch between different models using the provided script.

## Available Providers

- **Google** (Gemini models)
- **OpenAI** (GPT models)
- **Anthropic** (Claude models)
- **Mistral** (Mistral models)

## Setup

1. Add your API keys to the `.env` file:

```env
GOOGLE_GENERATIVE_AI_API_KEY=your_google_key_here
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
MISTRAL_API_KEY=your_mistral_key_here
```

2. Install dependencies:

```bash
pnpm install
```

## Usage

### List Available Models

To see all available models based on your API keys:

```bash
pnpm run switch-model list
```

### Switch Models

To switch to a specific model:

```bash
pnpm run switch-model switch <provider> <model>
```

#### Examples:

```bash
# Switch to Google Gemini 2.0 Flash
pnpm run switch-model switch google gemini-2.0-flash-001

# Switch to OpenAI GPT-4o
pnpm run switch-model switch openai gpt-4o

# Switch to Anthropic Claude 3.5 Sonnet
pnpm run switch-model switch anthropic claude-3-5-sonnet-20241022

# Switch to Mistral Large
pnpm run switch-model switch mistral mistral-large-latest
```

### Available Models

#### Google (Gemini)

- `gemini-2.0-flash-001` - Gemini 2.0 Flash
- `gemini-1.5-flash` - Gemini 1.5 Flash
- `gemini-2.5-flash-lite-preview-06-17` - Gemini 2.5 Flash Lite

#### OpenAI (GPT)

- `gpt-4o` - GPT-4o
- `gpt-4o-mini` - GPT-4o Mini
- `gpt-4-turbo` - GPT-4 Turbo

#### Anthropic (Claude)

- `claude-3-5-sonnet-20241022` - Claude 3.5 Sonnet
- `claude-3-5-haiku-20241022` - Claude 3.5 Haiku
- `claude-3-opus-20240229` - Claude 3 Opus

#### Mistral

- `mistral-large-latest` - Mistral Large
- `mistral-medium-latest` - Mistral Medium
- `mistral-small-latest` - Mistral Small

## Important Notes

1. **Restart Required**: After switching models, restart your development server for changes to take effect:

   ```bash
   pnpm dev
   ```

2. **API Key Required**: You need the corresponding API key for the provider you want to use.

3. **Fallback**: If no API keys are available, the system will fall back to Google Gemini.

4. **Priority Order**: The system uses this priority order when multiple providers are available:
   - Google (default)
   - OpenAI
   - Anthropic
   - Mistral

## Troubleshooting

- **"No models available"**: Make sure you have at least one API key in your `.env` file
- **"API key not found"**: Verify your API key is correctly set in the `.env` file
- **"Model not found"**: Check the model name spelling and ensure it's supported

## Development

The model switching system is implemented in:

- `model.ts` - Model definitions and switching logic
- `scripts/switch-model.ts` - Command-line tool for switching models
- `src/env.js` - Environment variable validation
