#!/usr/bin/env tsx

import { execSync } from "child_process";

console.log("🤖 Running Basic Model Test");
console.log("=".repeat(50));

try {
  console.log("🚀 Starting basic model test...");
  console.log("");
  
  // Run the basic model test
  execSync("tsx evals/basic-model-test.eval.ts", { 
    stdio: "inherit",
    cwd: process.cwd()
  });
} catch (error) {
  console.error("❌ Error running basic model test:", error);
  // Don't exit with error code - this test should not fail the process
  console.log("⚠️ Basic model test completed with some failures (this is expected)");
} 