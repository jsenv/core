import { RuleTester } from "eslint";
import { existsSync, readFileSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import rule from "../lib/rules/no-extra-params.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "fixtures");

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

// Load all test cases from flat structure
const testDirs = readdirSync(fixturesDir).sort(); // Ensure order based on numbering

const validCases = [];
const invalidCases = [];

for (const testDir of testDirs) {
  const testPath = join(fixturesDir, testDir);
  const code = readFileSync(join(testPath, "input.js"), "utf8");
  const expectedPath = join(testPath, "expected.json");

  // Clean up test name by removing number prefix and converting underscores to spaces
  const name = testDir.replace(/^\d+_(good|bad)_/, "").replace(/_/g, " ");

  if (existsSync(expectedPath)) {
    // Invalid case - has expected.json file
    const expectedData = JSON.parse(readFileSync(expectedPath, "utf8"));
    invalidCases.push({
      name,
      code,
      errors: expectedData, // The expected.json should be the errors array
    });
  } else {
    // Valid case - no expected.json file
    validCases.push({
      name,
      code,
    });
  }
}

ruleTester.run("no-extra-params", rule, {
  valid: validCases,
  invalid: invalidCases,
});
