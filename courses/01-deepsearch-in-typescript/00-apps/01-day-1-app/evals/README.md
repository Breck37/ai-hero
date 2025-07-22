# Efficient Evaluation Setup

This directory contains optimized evaluation configurations to minimize LLM usage and costs while still providing meaningful feedback on your application's performance.

## 🎯 Quick Reference

| Command                    | Cost          | Use Case          | Terminal Output    |
| -------------------------- | ------------- | ----------------- | ------------------ |
| `pnpm run evals:detailed`  | **Low**       | Daily development | ✅ Rich & detailed |
| `pnpm run evals:efficient` | **Low**       | Quick testing     | ⚠️ Basic           |
| `pnpm run evals:initial`   | **High**      | Release testing   | ⚠️ Basic           |
| `pnpm run evals`           | **Very High** | All evaluations   | ⚠️ Basic           |

**💡 Recommendation**: Use `pnpm run evals:detailed` for daily development - it provides the best feedback without LLM costs!

## 🚀 Quick Start

### Running Specific Evaluations

**⚠️ Important**: Running `pnpm run evals` will execute ALL evaluation files, which can be expensive. Use specific commands instead:

#### For Development (Low Cost - No LLM Calls)

```bash
# Efficient evaluation with detailed terminal output
pnpm run evals:detailed

# Or basic efficient evaluation
pnpm run evals:efficient
```

#### For Production Testing (Higher Cost - Includes LLM Calls)

```bash
# Initial evaluation with factuality scorer (expensive)
pnpm run evals:initial
```

#### Run All Evaluations (Use with caution)

```bash
# This runs ALL evaluation files - can be expensive!
pnpm run evals
```

## 📊 Evaluation Files

### `detailed.eval.ts` (Recommended for Development)

- **Cost**: Very low (no LLM calls for scoring)
- **Speed**: Fast
- **Scorers**: 6 deterministic scorers
- **Terminal Output**: Rich, detailed feedback with emojis and metrics
- **Use case**: Daily development, detailed analysis
- **Command**: `pnpm run evals:detailed`

### `efficient.eval.ts` (Basic)

- **Cost**: Very low (no LLM calls for scoring)
- **Speed**: Fast
- **Scorers**: 6 deterministic scorers
- **Terminal Output**: Basic
- **Use case**: Quick testing, CI/CD
- **Command**: `pnpm run evals:efficient`

### `initial.eval.ts` (Comprehensive - Expensive)

- **Cost**: Medium (includes factuality scorer with LLM calls)
- **Speed**: Slower due to LLM calls
- **Scorers**: 4 deterministic + 1 LLM-based
- **Use case**: Release testing, comprehensive evaluation
- **Command**: `pnpm run evals:initial`

## 🎯 Deterministic Scorers

These scorers don't require LLM calls and provide immediate feedback:

1. **Contains Links** - Checks for markdown links
2. **Response Length** - Evaluates appropriate response length
3. **Source Count** - Counts number of sources cited
4. **Has Code Blocks** - Checks for code examples
5. **Link Quality** - Evaluates descriptive link titles vs raw URLs
6. **Response Structure** - Checks formatting and organization

## ⚙️ Configuration

Edit `config.ts` to control evaluation behavior:

```typescript
export const evalConfig = {
  enableFactualityScorer: false, // Set to true for comprehensive testing
  evalRateLimit: {
    maxRequests: 5, // Max evaluations per minute
    windowMs: 60_000,
  },
  enableCaching: true,
  enableBatching: true,
};
```

## 💡 Optimization Strategies

### 1. **Caching**

- Factuality results are cached to avoid duplicate LLM calls
- Cache persists across evaluation runs

### 2. **Deterministic Scorers**

- Use regex and text analysis instead of LLM calls
- Provide immediate feedback without API costs

### 3. **Rate Limiting**

- Built-in rate limiting for evaluation LLM calls
- Prevents quota exhaustion

### 4. **Batching**

- Process multiple evaluations together when possible
- Reduces overhead

### 5. **Fallback Behavior**

- Graceful degradation when LLM calls fail
- Continue evaluation with deterministic scores

## 🔄 Migration Guide

### From `initial.eval.ts` to `efficient-eval.ts`:

1. **Update imports** in your evaluation files
2. **Use deterministic scorers** for development
3. **Enable factuality scorer** only for comprehensive testing
4. **Monitor costs** and adjust configuration as needed

## 📈 Cost Optimization Tips

1. **Use efficient-eval.ts for daily development**
2. **Enable factuality scorer only for release testing**
3. **Cache results** to avoid duplicate evaluations
4. **Set appropriate rate limits** to prevent quota exhaustion
5. **Use deterministic scorers** for most feedback

## 🛠️ Customization

### Adding New Deterministic Scorers

```typescript
const CustomScorer = createScorer<Message[], string, string>({
  name: "Custom Metric",
  description: "Your custom evaluation logic",
  scorer: ({ output }) => {
    // Your deterministic logic here
    return score; // 0-1 score
  },
});
```

### Adding New Test Cases

```typescript
const testData: { input: Message[]; expected: string }[] = [
  {
    input: [{ id: "1", role: "user" as const, content: "Your question" }],
    expected: "Expected answer",
  },
];
```

This setup allows you to evaluate your application effectively while keeping costs under control!
