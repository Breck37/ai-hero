#!/usr/bin/env tsx

import { execSync } from "child_process";
import { env } from "../src/env";

console.log("🤖 Running Main Eval with Anthropic Models");
console.log("=".repeat(50));

if (!env.ANTHROPIC_API_KEY) {
  console.log("❌ ANTHROPIC_API_KEY not set");
  process.exit(1);
}

try {
  console.log("🚀 Starting main eval with Anthropic models...");
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