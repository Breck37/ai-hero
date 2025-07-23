# Evaluation Setup

This directory contains evaluation configurations for testing the deep search application with different models and datasets.

## 🎯 Quick Reference

| Command                    | Cost     | Use Case         | Description                     |
| -------------------------- | -------- | ---------------- | ------------------------------- |
| `pnpm run evals:main`      | **High** | Main evaluation  | Factuality + AnswerRelevancy    |
| `pnpm run evals:google`    | **High** | Google models    | Main eval with Google models    |
| `pnpm run evals:openai`    | **High** | OpenAI models    | Main eval with OpenAI models    |
| `pnpm run evals:anthropic` | **High** | Anthropic models | Main eval with Anthropic models |
| `pnpm run evals:mistral`   | **High** | Mistral models   | Main eval with Mistral models   |
| `pnpm run test-models`     | **Low**  | Model testing    | Basic "Hi" test for all models  |

## 🚀 Quick Start

### Main Evaluation (Factuality + AnswerRelevancy)

The main evaluation uses two LLM-based scorers:

- **Factuality**: Compares answers against ground truth
- **AnswerRelevancy**: Evaluates how relevant each part of the answer is to the question

```bash
# Run main eval with current model
pnpm run evals:main

# Run main eval with specific model providers
pnpm run evals:google
pnpm run evals:openai
pnpm run evals:anthropic
pnpm run evals:mistral
```

### Basic Model Testing

Test all available models with a simple "Hi" message:

```bash
pnpm run test-models
```

This test will not fail if any models fail - it's designed to verify which models are working.

## 📊 Dataset Structure

The evaluation uses different datasets based on the `EVAL_DATASET` environment variable:

### Development Dataset (Default)

- **2 simple questions** for development testing
- Questions about Next.js 15 features and TypeScript version
- Use case: Quick development feedback

### CI Dataset (`EVAL_DATASET=ci`)

- **2 medium complexity questions** for CI testing
- Questions about Vercel deployment and TypeScript configuration
- Use case: Continuous integration testing

### Regression Dataset (`EVAL_DATASET=regression`)

- **2 complex questions** for comprehensive testing
- Questions about React/Next.js compatibility and Turbopack architecture
- Use case: Comprehensive regression testing

## 🎯 Scorers

### Main Evaluation Scorers

1. **Factuality** - LLM-based scorer that compares the model's answer against ground truth

   - Uses Google Gemini 1.5 Flash
   - Returns score 0-1 based on factual accuracy
   - Includes detailed rationale

2. **AnswerRelevancy** - LLM-based scorer that evaluates answer relevance
   - Two-step process: statement generation + relevancy evaluation
   - Uses Google Gemini 1.5 Flash
   - Returns score 0-1 based on average relevancy of statements
   - Includes detailed breakdown of statements and verdicts

### Basic Model Test

- **Simple Response Test** - Verifies each model can respond to "Hi"
- **No LLM scoring** - Just functional testing
- **Graceful failure** - Continues even if some models fail

## ⚙️ Configuration

### Environment Variables

Set `EVAL_DATASET` to control which dataset to use:

```bash
# Development (default)
export EVAL_DATASET=dev

# CI testing
export EVAL_DATASET=ci

# Regression testing
export EVAL_DATASET=regression
```

### API Keys Required

The evaluations require API keys for the models being tested:

- `GOOGLE_GENERATIVE_AI_API_KEY` - For Google models
- `OPENAI_API_KEY` - For OpenAI models
- `ANTHROPIC_API_KEY` - For Anthropic models
- `MISTRAL_API_KEY` - For Mistral models

## 📁 File Structure

```
evals/
├── main.eval.ts              # Main evaluation with Factuality + AnswerRelevancy
├── basic-model-test.eval.ts  # Basic model functionality test
├── answer-relevancy.eval.ts  # AnswerRelevancy scorer implementation
├── initial.eval.ts           # Legacy eval (includes Factuality scorer)
├── detailed.eval.ts          # Legacy detailed eval
├── efficient.eval.ts         # Legacy efficient eval
├── dev.ts                    # Development dataset (2 simple questions)
├── ci.ts                     # CI dataset (2 medium questions)
├── regression.ts             # Regression dataset (2 complex questions)
└── utils.ts                  # Dataset utilities

scripts/
├── eval-google.ts            # Google model eval script
├── eval-openai.ts            # OpenAI model eval script
├── eval-anthropic.ts         # Anthropic model eval script
├── eval-mistral.ts           # Mistral model eval script
└── test-models.ts            # Basic model test script
```

## 💡 Usage Examples

### Development Workflow

```bash
# Test all models work
pnpm run test-models

# Run main eval with current model
pnpm run evals:main

# Run with specific provider
pnpm run evals:google
```

### CI/CD Pipeline

```bash
# Set CI dataset
export EVAL_DATASET=ci

# Run evaluation
pnpm run evals:main
```

### Comprehensive Testing

```bash
# Set regression dataset
export EVAL_DATASET=regression

# Run with all providers
pnpm run evals:google
pnpm run evals:openai
pnpm run evals:anthropic
pnpm run evals:mistral
```

## 🔧 Troubleshooting

### Common Issues

1. **API Quota Exceeded**

   - The evaluations use LLM calls which can hit rate limits
   - Check your API provider's quota and billing
   - Consider using the basic model test first

2. **Model Not Responding**

   - Run `pnpm run test-models` to verify model connectivity
   - Check API keys are set correctly
   - Verify network connectivity

3. **Evaluation Failing**
   - Check that the required API keys are set
   - Verify the dataset files exist
   - Check for TypeScript compilation errors

### Performance Tips

- **Use specific model scripts** instead of the generic `evals:main`
- **Start with basic model test** to verify connectivity
- **Monitor API usage** to avoid quota issues
- **Use development dataset** for quick feedback during development
