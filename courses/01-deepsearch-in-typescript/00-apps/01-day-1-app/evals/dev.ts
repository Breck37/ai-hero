import type { DatasetItem } from "./utils";

export const devData: DatasetItem[] = [
  // Hard questions - toughest cases for development testing
  {
    id: "react-nextjs-compatibility",
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
    id: "typescript-react-ecosystem",
    name: "TypeScript and React Ecosystem Integration",
    type: "multi-hop",
    input:
      "How does TypeScript 5.8 integrate with React 19 and Next.js 15, and what are the performance implications?",
    expected: `The integration between TypeScript 5.8, React 19, and Next.js 15 creates a powerful development ecosystem:

**TypeScript 5.8 + React 19 Integration:**
- TypeScript 5.8 provides enhanced type inference for React 19's new hooks
- Better support for the React Compiler's optimizations
- Improved type checking for Server Components and Client Components
- Enhanced IntelliSense for React 19's new APIs

**Next.js 15 + TypeScript 5.8 Benefits:**
- Native TypeScript support in next.config.ts (no need for separate config files)
- Improved type checking during build time with Turbopack
- Better error messages and type inference for App Router patterns
- Enhanced developer experience with TypeScript-first approach

**Performance Implications:**
1. **Build Performance:** TypeScript 5.8 + Turbopack provides faster compilation times
2. **Runtime Performance:** React 19's compiler optimizations work better with TypeScript's type information
3. **Bundle Size:** TypeScript's tree-shaking capabilities reduce final bundle size
4. **Development Speed:** Better type inference reduces development time and errors

**Key Features:**
- Automatic type inference for Server Actions
- Enhanced type safety for route parameters and search params
- Better support for async components and Suspense boundaries
- Improved type checking for middleware and API routes`,
    difficulty: "hard",
    description:
      "Requires understanding the interplay between three major technologies",
  },
  {
    id: "react-evolution",
    name: "React Evolution Timeline",
    type: "temporal",
    input:
      "How has React evolved from version 16 to 19, and what major changes have impacted the Next.js ecosystem?",
    expected: `React's evolution from version 16 to 19 has significantly shaped the Next.js ecosystem:

**React 16 (2017-2019):**
- Introduction of Hooks (useState, useEffect, etc.)
- Context API for state management
- Error Boundaries for better error handling
- Next.js 9-12 adapted to support these features

**React 17 (2020):**
- Gradual upgrades with concurrent features
- New JSX Transform
- Event delegation improvements
- Next.js 10-12 provided stable support

**React 18 (2022):**
- Concurrent rendering with automatic batching
- Suspense for data fetching
- Strict Mode improvements
- Next.js 12-14 fully embraced these features

**React 19 (2024-2025):**
- React Compiler for automatic optimizations
- New hooks: useActionState, useFormStatus, useOptimistic
- Improved hydration and error handling
- Next.js 15 provides full support

**Impact on Next.js Ecosystem:**
1. **App Router:** Built specifically for React 18+ concurrent features
2. **Server Components:** Leverage React 18+ Suspense capabilities
3. **Performance:** Each React version brought performance improvements
4. **Developer Experience:** Hooks and concurrent features improved DX

**Migration Challenges:**
- React 16-17: Hooks adoption required significant refactoring
- React 18: Concurrent features needed careful implementation
- React 19: Compiler features are still experimental`,
    difficulty: "hard",
    description:
      "Requires understanding React's evolution over time and its impact on Next.js",
  },
  {
    id: "turbopack-deep-dive",
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
  // Medium questions for variety
  {
    id: "nextjs-15-features",
    name: "Next.js 15 Features",
    type: "single-hop",
    input: "What are the main features of Next.js 15?",
    expected: `Next.js 15 introduces several new features and improvements. Here's a summary of the key highlights:

1. React 19 Support:
- Next.js 15 offers full support for React 19, including new hooks like useActionState, useFormStatus, and useOptimistic
- The App Router uses React 19 RC, while the Pages Router maintains backward compatibility with React 18
- Experimental support for the React Compiler is included
- Improved hydration error view with source code and suggestions

2. Caching Improvements:
- GET Route Handlers and Client Router Cache no longer cache by default. You can opt-in to caching using static route config

3. Turbopack:
- Turbopack dev is now stable (next dev --turbo)
- Alpha release of next build --turbopack for faster production builds
- Turbopack configuration moved to the top-level turbopack key in next.config.ts

4. New Components and APIs:
- <Form> component for enhanced HTML forms with client-side navigation
- unstable_after API (Experimental) to execute code after a response finishes streaming
- instrumentation.js API (Stable) for server lifecycle observability
- Navigation hooks: onNavigate and useLinkStatus for controlling routing

5. Development and Build Improvements:
- Static Route Indicator during development
- Server Components HMR (Hot Module Replacement) improvements
- Faster Static Generation for the App Router
- TypeScript support for next.config.ts

6. Security Enhancements:
- Enhanced security for Server Actions with unguessable endpoints and removal of unused actions

7. Other Changes:
- ESLint 9 Support
- Improvements for self-hosting, including more control over Cache-Control headers
- Optimizing bundling of external packages (Stable)
- Community support for Rspack (experimental)`,
    difficulty: "medium",
    description: "Feature list compilation from multiple sources",
  },
  {
    id: "nextjs-vs-remix",
    name: "Next.js 15 vs Remix Comparison",
    type: "comparison",
    input:
      "Compare Next.js 15 and Remix in terms of performance, developer experience, and ecosystem support. Which would you recommend for a new project?",
    expected: `Here's a comprehensive comparison between Next.js 15 and Remix:

**Performance:**
- **Next.js 15:** Excellent performance with Turbopack (now stable), automatic code splitting, and React 19 support. Strong focus on Core Web Vitals
- **Remix:** Built on Web Standards, excellent performance with nested routing and efficient data loading. Smaller bundle sizes due to no client-side routing

**Developer Experience:**
- **Next.js 15:** Excellent DX with TypeScript support, hot reloading, and extensive documentation. Large ecosystem and community
- **Remix:** Great DX with nested routing, built-in error boundaries, and progressive enhancement. Strong focus on web fundamentals

**Ecosystem Support:**
- **Next.js 15:** Massive ecosystem with Vercel integration, extensive plugins, and enterprise support
- **Remix:** Growing ecosystem with Shopify backing, strong focus on web standards

**Key Differences:**
1. **Routing:** Next.js uses file-based routing, Remix uses nested routing
2. **Data Loading:** Next.js has Server Components, Remix uses loaders and actions
3. **Styling:** Next.js has built-in CSS modules, Remix is framework-agnostic
4. **Deployment:** Next.js optimized for Vercel, Remix works anywhere

**Recommendation:**
- Choose **Next.js 15** for: Large teams, enterprise projects, Vercel deployment, extensive ecosystem needs
- Choose **Remix** for: Web standards focus, smaller teams, custom deployment, progressive enhancement`,
    difficulty: "medium",
    description: "Requires comparing multiple aspects of two frameworks",
  },
  // Easy questions for baseline testing
  {
    id: "typescript-latest",
    name: "TypeScript Latest Version",
    type: "single-hop",
    input: "What is the latest version of TypeScript?",
    expected: `The latest stable version of TypeScript is **5.8.3**, released on April 7, 2025. TypeScript 5.9 is currently in beta.

Here's a summary of the information found in the scraped pages:

*   **NPM:** The NPM package registry indicates the latest version of TypeScript is 5.8.3, last published 4 months ago. [typescript - NPM](https://www.npmjs.com/package/typescript)
*   **GitHub Releases:** The TypeScript GitHub repository lists version 5.8.3 as the latest stable release. The 5.9 version is currently in beta. [Releases · microsoft/TypeScript - GitHub](https://github.com/microsoft/typescript/releases)
*   **Microsoft Developer Blogs:** Microsoft announced the release of TypeScript 5.8 on March 5, 2025. [Announcing TypeScript 5.8 - Microsoft Developer Blogs](https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/)
*   **TypeScript Website:** The official TypeScript website states that version 5.8 is now available, and 5.9 is currently in beta. [TypeScript: JavaScript With Syntax For Types.](https://www.typescriptlang.org/)
*   **TypeScript Download Page:** The download page confirms that the latest version available through npm is 5.8. [How to set up TypeScript](https://www.typescriptlang.org/download/)`,
    difficulty: "easy",
    description: "Simple version lookup requiring current information",
  },
  {
    id: "eli-tomac",
    name: "Eli Tomac",
    type: "single-hop",
    input: "What team is Eli Tomac signing with for 2026?",
    expected: `Eli Tomac is signing with the Red Bull KTM Factory Racing team for 2026.`,
    difficulty: "medium",
    description: "Simple version lookup requiring current information",
  },
];
