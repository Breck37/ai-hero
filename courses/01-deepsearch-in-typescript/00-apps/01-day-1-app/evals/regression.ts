import type { DatasetItem } from "./utils";

export const regressionData: DatasetItem[] = [
  // Complex questions for comprehensive regression testing
  {
    id: "react-nextjs-compatibility-analysis",
    name: "React and Next.js Compatibility Analysis",
    type: "multi-hop",
    input:
      "What React version does Next.js 15 support, and what are the key differences between using React 18 vs React 19 in Next.js 15?",
    expected: `Next.js 15 supports both React 18 and React 19, with different capabilities for each:

**React 19 Support in Next.js 15:**
- Full support for React 19 including new hooks: useActionState, useFormStatus, and useOptimistic
- App Router uses React 19 RC by default
- Experimental support for the React Compiler
- Improved hydration error view with source code and suggestions

**React 18 Support in Next.js 15:**
- Pages Router maintains backward compatibility with React 18
- All existing React 18 features continue to work
- Stable, production-ready support

**Key Differences:**
1. **App Router vs Pages Router:** App Router automatically uses React 19 RC, while Pages Router stays on React 18 for stability
2. **New Hooks:** React 19 introduces new hooks that are only available when using the App Router
3. **Compiler Support:** React Compiler experimental features are only available with React 19
4. **Hydration:** React 19 provides better hydration error handling and debugging

**Migration Considerations:**
- Existing React 18 apps can continue using Pages Router without changes
- To access React 19 features, apps need to use the App Router
- The React Compiler is experimental and may have breaking changes`,
    difficulty: "hard",
    description:
      "Requires understanding both React version differences and Next.js routing systems",
  },
  {
    id: "turbopack-technical-deep-dive",
    name: "Turbopack Technical Deep Dive",
    type: "technical-deep-dive",
    input:
      "Explain how Turbopack works in Next.js 15, its architecture, and how it compares to Webpack. Include specific performance metrics and implementation details.",
    expected: `Turbopack in Next.js 15 represents a significant evolution in build tooling:

**Turbopack Architecture:**
- Built in Rust for performance and memory efficiency
- Incremental compilation with persistent caching
- Parallel processing of modules and dependencies
- Native support for TypeScript, JSX, and modern JavaScript features

**How Turbopack Works:**
1. **Incremental Compilation:** Only recompiles changed files and their dependencies
2. **Persistent Caching:** Stores compiled results on disk for faster subsequent builds
3. **Parallel Processing:** Utilizes multiple CPU cores for faster compilation
4. **Smart Dependency Resolution:** Optimized algorithm for resolving module dependencies

**Performance Comparison with Webpack:**
- **Development:** 10-100x faster than Webpack in development mode
- **Production:** Currently alpha, but showing promising results
- **Memory Usage:** Significantly lower memory footprint
- **Startup Time:** Near-instant startup compared to Webpack's slower initialization

**Next.js 15 Integration:**
- Stable in development: \`next dev --turbo\`
- Alpha in production: \`next build --turbopack\`
- Configuration via \`turbopack\` key in next.config.ts
- Automatic fallback to Webpack if Turbopack fails

**Technical Implementation:**
- Uses SWC for JavaScript/TypeScript compilation
- Native support for CSS modules and PostCSS
- Optimized for React Server Components
- Built-in support for Next.js-specific features

**Limitations and Considerations:**
- Production builds still in alpha
- Some plugins may not be compatible
- Requires Next.js 15+
- Performance benefits most noticeable in large projects`,
    difficulty: "hard",
    description:
      "Requires deep technical understanding of build tools and performance optimization",
  },
];
