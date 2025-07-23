#!/usr/bin/env tsx

import { execSync } from "child_process";
import { env } from "../src/env";

console.log("🤖 Running Main Eval with Google Models");
console.log("=".repeat(50));

if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
  console.log("❌ GOOGLE_GENERATIVE_AI_API_KEY not set");
  process.exit(1);
}

try {
  console.log("🚀 Starting main eval with Google models...");
  console.log("");
  
  // Run the main eval
  execSync("evalite watch evals/main.eval.ts", { 
    stdio: "inherit",
    cwd: process.cwd()
  });
} catch (error) {
  console.error("❌ Error running eval:", error);
  process.exit(1);
} 