import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesPath = join(__dirname, "fixtures");
const mainFilePath = join(fixturesPath, "src", "main.js");

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

// Test with nested directory structure and resolver
ruleTester.run(
  "no-unknown-params with nested import resolution",
  noUnknownParamsRule,
  {
    valid: [
      {
        // Test nested imports work with resolver
        code: `
        import { validateUser } from '../utils/validation.js';
        validateUser({ id: 1, email: "test@test.com" });
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
        // Test nested imports detect invalid parameters
        code: `
        import { validateUser } from '../utils/validation.js';
        validateUser({ id: 1, email: "test@test.com", password: "secret" });
      `,
        output: `
        import { validateUser } from '../utils/validation.js';
        validateUser({ id: 1, email: "test@test.com" });
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
            data: {
              param: "password",
              func: "validateUser",
              expected: "id, email",
            },
          },
        ],
      },
    ],
  },
);

console.log("✅ Nested import resolution tests passed!");
