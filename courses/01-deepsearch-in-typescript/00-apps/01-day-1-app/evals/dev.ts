import type { DatasetItem } from "./utils";

export const devData: DatasetItem[] = [
  // Simple questions for development testing
  {
    id: "nextjs-15-features",
    name: "Next.js 15 Features",
    type: "single-hop",
    input: "What are the main features of Next.js 15?",
    expected: `Next.js 15 includes several key features and improvements:

**Core Features:**
- **React 19 Support:** Full support for React 19 with new hooks and compiler
- **Turbopack:** Stable bundler for development with improved performance
- **App Router:** Enhanced routing system with better performance
- **Server Components:** Improved server-side rendering capabilities

**Performance Improvements:**
- **Faster Builds:** Turbopack provides significantly faster development builds
- **Better Caching:** Enhanced caching strategies for improved performance
- **Optimized Bundling:** More efficient code splitting and bundling

**Developer Experience:**
- **TypeScript Support:** Native TypeScript support with improved type checking
- **Better Error Messages:** Enhanced error reporting and debugging
- **Hot Reload:** Improved hot reload performance with Turbopack

**New APIs and Hooks:**
- **useActionState:** New hook for managing form state
- **useFormStatus:** Hook for form submission status
- **useOptimistic:** Hook for optimistic updates

**Stability and Compatibility:**
- **Backward Compatibility:** Maintains compatibility with existing Next.js 14 projects
- **Gradual Migration:** Easy migration path from previous versions
- **Production Ready:** Stable release with production-ready features`,
    difficulty: "easy",
    description: "Basic overview of Next.js 15 features",
  },
  {
    id: "typescript-latest-version",
    name: "TypeScript Latest Version",
    type: "single-hop",
    input: "What is the latest version of TypeScript?",
    expected: `The latest version of TypeScript is **TypeScript 5.8**.

**Key Features of TypeScript 5.8:**
- **Enhanced Type Inference:** Improved type checking and inference capabilities
- **Better Performance:** Faster compilation and type checking
- **New Language Features:** Additional TypeScript language enhancements
- **Improved Tooling:** Better IDE support and developer experience

**Release Information:**
- **Release Date:** Released in recent updates
- **Stability:** Production-ready with stable features
- **Compatibility:** Works well with modern JavaScript frameworks
- **Documentation:** Comprehensive documentation and migration guides

**Integration:**
- **Framework Support:** Excellent support for React, Next.js, and other frameworks
- **Build Tools:** Compatible with modern build tools and bundlers
- **IDE Support:** Enhanced support in VS Code and other IDEs`,
    difficulty: "easy",
    description: "Simple question about TypeScript version",
  },
];
