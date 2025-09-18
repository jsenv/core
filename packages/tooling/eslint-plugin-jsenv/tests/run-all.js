#!/usr/bin/env node

import { execSync } from "child_process";
import { readdirSync } from "fs";
import { join } from "path";

const testsDir = join(import.meta.dirname);
const testDirectories = readdirSync(testsDir, { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory() && dirent.name.match(/^\d+_/))
  .map((dirent) => dirent.name)
  .sort();

console.log(`Running ${testDirectories.length} test suites...\n`);

let totalPassed = 0;
let totalFailed = 0;

for (const testDir of testDirectories) {
  const testFiles = readdirSync(join(testsDir, testDir)).filter((file) =>
    file.endsWith(".test.js"),
  );

  if (testFiles.length === 0) {
    console.log(`⚠️  No test files found in ${testDir}`);
    continue;
  }

  for (const testFile of testFiles) {
    const testPath = join(testsDir, testDir, testFile);
    const testName = `${testDir}/${testFile}`;

    try {
      execSync(`node "${testPath}"`, {
        stdio: "pipe",
        cwd: process.cwd(),
      });
      console.log(`✅ ${testName}`);
      totalPassed++;
    } catch (error) {
      console.log(`❌ ${testName}`);
      console.log(`   Error: ${error.message}`);
      totalFailed++;
    }
  }
}

console.log(`\nTest Results:`);
console.log(`✅ Passed: ${totalPassed}`);
console.log(`❌ Failed: ${totalFailed}`);
console.log(`📊 Total: ${totalPassed + totalFailed}`);

if (totalFailed > 0) {
  process.exit(1);
} else {
  console.log(`\n🎉 All tests passed!`);
}
