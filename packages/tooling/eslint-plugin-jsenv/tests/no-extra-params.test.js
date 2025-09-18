import { RuleTester } from "eslint";
import { readFileSync, readdirSync } from "fs";
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

// Load valid test cases
const validDir = join(fixturesDir, "valid");
const validCases = readdirSync(validDir)
  .sort() // Ensure order based on numbering
  .map((testDir) => {
    const testPath = join(validDir, testDir);
    const code = readFileSync(join(testPath, "input.js"), "utf8");
    return {
      name: testDir.replace(/^\d+_/, "").replace(/_/g, " "),
      code,
    };
  });

// Load invalid test cases
const invalidDir = join(fixturesDir, "invalid");
const invalidCases = readdirSync(invalidDir)
  .sort() // Ensure order based on numbering
  .map((testDir) => {
    const testPath = join(invalidDir, testDir);
    const code = readFileSync(join(testPath, "input.js"), "utf8");
    const errors = JSON.parse(
      readFileSync(join(testPath, "errors.json"), "utf8"),
    );
    return {
      name: testDir.replace(/^\d+_/, "").replace(/_/g, " "),
      code,
      errors,
    };
  });

ruleTester.run("no-extra-params", rule, {
  valid: validCases,
  invalid: invalidCases,
});
