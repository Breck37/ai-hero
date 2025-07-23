import type { DatasetItem } from "./utils";

export const ciData: DatasetItem[] = [
  // Medium complexity questions for CI testing
  {
    id: "vercel-deployment-features",
    name: "Vercel Deployment Features",
    type: "single-hop",
    input:
      "What are the key deployment features and optimizations that Vercel provides for Next.js applications?",
    expected: `Vercel provides comprehensive deployment features and optimizations for Next.js applications:

**Core Deployment Features:**
- **Zero-Configuration Deployment:** Automatic detection and optimization of Next.js projects
- **Global Edge Network:** Content delivered from 35+ edge locations worldwide
- **Automatic HTTPS:** SSL certificates provisioned and renewed automatically
- **Preview Deployments:** Automatic preview URLs for every pull request

**Performance Optimizations:**
- **Edge Functions:** Serverless functions running at the edge for low latency
- **Image Optimization:** Automatic WebP/AVIF conversion and responsive images
- **Static Asset Optimization:** Automatic compression and caching strategies
- **Incremental Static Regeneration:** Background updates of static pages

**Developer Experience:**
- **Git Integration:** Automatic deployments from Git repositories
- **Environment Variables:** Secure management of environment variables
- **Analytics:** Built-in performance and usage analytics
- **Debugging Tools:** Advanced debugging and logging capabilities

**Enterprise Features:**
- **Team Collaboration:** Role-based access control and team management
- **Custom Domains:** Easy domain management with DNS optimization
- **API Routes:** Serverless API endpoints with automatic scaling
- **Database Integration:** Native support for various databases

**Monitoring and Observability:**
- **Real-time Metrics:** Performance monitoring and alerting
- **Error Tracking:** Automatic error detection and reporting
- **Function Logs:** Detailed logging for serverless functions
- **Performance Insights:** Core Web Vitals and user experience metrics`,
    difficulty: "medium",
    description: "Comprehensive overview of Vercel's deployment capabilities",
  },
  {
    id: "typescript-config-best-practices",
    name: "TypeScript Configuration Best Practices",
    type: "single-hop",
    input:
      "What are the recommended TypeScript configuration settings for a Next.js 15 project, and how do they differ from a standard React project?",
    expected: `Recommended TypeScript configuration for Next.js 15 projects:

**Next.js 15 Specific Configuration:**
\`\`\`json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
\`\`\`

**Key Differences from Standard React Projects:**
1. **Module Resolution:** Uses "bundler" instead of "node" for better Next.js compatibility
2. **JSX Handling:** Uses "preserve" instead of "react-jsx" for Next.js optimization
3. **Next.js Plugin:** Includes the Next.js TypeScript plugin for enhanced type checking
4. **Path Mapping:** Built-in support for \`@/*\` alias mapping
5. **Type Definitions:** Includes Next.js-specific type definitions

**Advanced Configuration Options:**
- **Incremental Compilation:** Enabled for faster rebuilds
- **Skip Lib Check:** Recommended for better performance
- **Strict Mode:** Enabled for better type safety
- **Base URL:** Set to "." for consistent import paths

**Performance Optimizations:**
- **Incremental:** Reduces compilation time on subsequent builds
- **Skip Lib Check:** Improves performance by skipping type checking of declaration files
- **Module Resolution:** "bundler" mode optimizes for modern bundlers like Turbopack

**Framework Integration:**
- **Next.js Plugin:** Provides enhanced type checking for Next.js features
- **App Router Support:** Better type inference for App Router patterns
- **Server Components:** Improved type checking for Server and Client Components`,
    difficulty: "medium",
    description: "Detailed TypeScript configuration for Next.js projects",
  },
];
