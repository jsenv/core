import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

const fixturesDir = join(__dirname, "fixtures");
const mainFilePath = join(fixturesDir, "main.js");

// Test intermediate import resolution - re-exports and chaining
ruleTester.run(
  "no-unknown-params intermediate import resolution",
  noUnknownParamsRule,
  {
    valid: [
      {
        // Test with intermediate file re-exports (should work)
        options: [{ reportAllUnknownParams: true }],
        code: `
        import { processData, validateUser } from './intermediate.js';
        processData({ id: 1, name: "John" });
        validateUser({ username: "john", email: "john@test.com" });
      `,
        filename: mainFilePath,
      },
    ],
    invalid: [
      {
        // Test with intermediate file chain: main -> intermediate -> helper
        options: [{ reportAllUnknownParams: true }],
        code: `
        import { processData, validateUser } from './intermediate.js';
        processData({ id: 1, name: "John", age: 30 });
        validateUser({ username: "john", email: "john@test.com", isActive: true });
      `,
        output: `
        import { processData, validateUser } from './intermediate.js';
        processData({ id: 1, name: "John" });
        validateUser({ username: "john", email: "john@test.com" });
      `,
        filename: mainFilePath,
        errors: [
          {
            messageId: "not_found_param_with_file",
            data: {
              param: "age",
              func: "processData",
              filePath: "./helper.js",
            },
          },
          {
            messageId: "not_found_param_with_file",
            data: {
              param: "isActive",
              func: "validateUser",
              filePath: "./intermediate.js",
            },
          },
        ],
      },
    ],
  },
);

console.log("✅ Intermediate import resolution tests passed!");
