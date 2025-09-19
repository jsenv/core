import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesPath = join(__dirname, "fixtures");
const mainFilePath = join(fixturesPath, "main.js");

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

// Test with advanced import resolution using ESLint settings
ruleTester.run(
  "no-unknown-params with advanced import resolution",
  noUnknownParamsRule,
  {
    valid: [
      {
        // Test with import resolver settings - valid case
        code: `
        import { processData } from './helper.js';
        processData({ id: 1, name: "John" });
      `,
        filename: mainFilePath,
        settings: {
          "import-x/resolver": {
            "@jsenv/eslint-import-resolver": {
              rootDirectoryUrl: fixturesPath,
              packageConditions: ["browser", "import"],
            },
          },
        },
      },
    ],
    invalid: [
      {
        // Test with import resolver settings - invalid case
        code: `
        import { processData } from './helper.js';
        processData({ id: 1, name: "John", age: 30 });
      `,
        output: `
        import { processData } from './helper.js';
        processData({ id: 1, name: "John" });
      `,
        filename: mainFilePath,
        settings: {
          "import-x/resolver": {
            "@jsenv/eslint-import-resolver": {
              rootDirectoryUrl: fixturesPath,
              packageConditions: ["browser", "import"],
            },
          },
        },
        errors: [
          {
            messageId: "superfluous_param",
            data: { param: "age", func: "processData", expected: "id, name" },
          },
        ],
      },
    ],
  },
);

console.log("✅ Advanced import resolution tests passed!");
