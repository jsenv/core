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

// Test one function at a time to debug
ruleTester.run(
  "no-unknown-params debug multiple imports",
  noUnknownParamsRule,
  {
    valid: [],
    invalid: [
      {
        // Test just createUser first
        code: `
        import { createUser } from './user-service.js';
        createUser({ name: "John", email: "john@example.com", password: "secret" });
      `,
        output: `
        import { createUser } from './user-service.js';
        createUser({ name: "John", email: "john@example.com" });
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
              func: "createUser",
              expected: "name, email",
            },
          },
        ],
      },
    ],
  },
);

console.log("✅ Debug multiple imports tests passed!");
