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

// Test fallback behavior when no import resolver is configured
ruleTester.run(
  "no-unknown-params without import resolver (fallback mode)",
  noUnknownParamsRule,
  {
    valid: [
      {
        // Test fallback resolution works for relative imports
        code: `
        import { processData } from './helper.js';
        processData({ id: 1, name: "John" });
      `,
        filename: mainFilePath,
        // No import resolver settings - should fall back to default resolution
      },
    ],
    invalid: [
      {
        // Test fallback resolution detects errors for relative imports
        code: `
        import { processData } from './helper.js';
        processData({ id: 1, name: "John", age: 30 });
      `,
        output: `
        import { processData } from './helper.js';
        processData({ id: 1, name: "John" });
      `,
        filename: mainFilePath,
        // No import resolver settings - should fall back to default resolution
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

console.log("✅ Fallback import resolution tests passed!");
