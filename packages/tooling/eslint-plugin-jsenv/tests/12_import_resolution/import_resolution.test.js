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

// Basic import resolution test - direct import from single file
ruleTester.run(
  "no-unknown-params basic import resolution",
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
            messageId: "superfluous_param_with_file",
            data: {
              param: "age",
              func: "processData",
              expected: "id, name",
              filePath: "./helper.js",
            },
          },
        ],
      },
    ],
  },
);

console.log("✅ Basic import resolution tests passed!");
