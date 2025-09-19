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

// For now, let's test with a simpler approach without imports
// to verify the basic functionality works, then we'll enhance it
ruleTester.run(
  "no-unknown-params with import resolution",
  noUnknownParamsRule,
  {
    valid: [
      {
        // Test with local function definition (should work)
        code: `
        function processData({ id, name, ...rest }) {
          console.log(id, name, rest);
        }
        processData({ id: 1, name: "John" });
      `,
        filename: mainFilePath,
      },
      {
        // Test with intermediate file re-exports (should work)
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
        // Test with local function definition WITHOUT rest parameter (should catch error)
        code: `
        function processData({ id, name }) {
          console.log(id, name);
        }
        processData({ id: 1, name: "John", age: 30 });
      `,
        output: `
        function processData({ id, name }) {
          console.log(id, name);
        }
        processData({ id: 1, name: "John" });
      `,
        filename: mainFilePath,
        errors: [
          {
            messageId: "superfluous_param",
            data: { param: "age", func: "processData", expected: "id, name" },
          },
        ],
      },
      // Test with imports (this should work once import resolution is functional)
      {
        code: `
        import { processData } from './helper.js';
        processData({ id: 1, name: "John", age: 30 });
      `,
        output: `
        import { processData } from './helper.js';
        processData({ id: 1, name: "John" });
      `,
        filename: mainFilePath,
        errors: [
          {
            messageId: "superfluous_param",
            data: { param: "age", func: "processData", expected: "id, name" },
          },
        ],
      },
      // Test with intermediate file chain: main -> intermediate -> helper
      {
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
            messageId: "superfluous_param",
            data: { param: "age", func: "processData", expected: "id, name" },
          },
          {
            messageId: "superfluous_param",
            data: {
              param: "isActive",
              func: "validateUser",
              expected: "username, email",
            },
          },
        ],
      },
    ],
  },
);

console.log("✅ Import resolution tests passed!");
