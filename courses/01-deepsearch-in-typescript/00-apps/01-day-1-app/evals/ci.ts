import type { DatasetItem } from "./utils";

export const ciData: DatasetItem[] = [
  // Additional medium complexity questions for CI testing
  {
    id: "vercel-deployment",
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
    id: "typescript-config",
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
- **Skip Lib Check:** Skips type checking of declaration files
- **Isolated Modules:** Enables better tree-shaking

**Next.js 15 Enhancements:**
- Native TypeScript support in next.config.ts
- Improved type inference for Server Components
- Better error messages and type checking
- Enhanced support for async components`,
    difficulty: "medium",
    description: "Technical configuration details with practical examples",
  },
  // Additional easy questions for broader coverage
  {
    id: "supercross-2025",
    name: "Supercross 2025 SX Results",
    type: "single-hop",
    input: "Who has won the most races without winning a championship?",
    expected: `The rider with the most wins without a championship title is Ken Roczen. He has won over 10 races without winning a championship.`,
    difficulty: "easy",
    description: "Simple version lookup requiring current information",
  },
  {
    id: "supercross-all-time-wins",
    name: "Supercross All-Time Wins",
    type: "single-hop",
    input: "Who has won the most races in the history of supercross?",
    expected: `The rider with the most wins in the history of supercross is Jeremy McGrath with 72 supercross wins.`,
    difficulty: "easy",
    description: "Simple version lookup requiring current information",
  },
  {
    id: "MX-goat",
    name: "MX Goat",
    type: "single-hop",
    input: "Who is the goat of supercross?",
    expected: `The goat of supercross is Ricky Carmichael. He has won 10 championships and over 100 races between supercross and motocross.`,
    difficulty: "easy",
    description: "Simple version lookup requiring current information",
  },
];
