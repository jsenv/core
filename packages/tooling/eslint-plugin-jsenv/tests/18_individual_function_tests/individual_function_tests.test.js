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

// Test each function individually to find the issue
ruleTester.run(
  "no-unknown-params individual function tests",
  noUnknownParamsRule,
  {
    valid: [],
    invalid: [
      {
        // Test createUser
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
      {
        // Test updateUser
        code: `
        import { updateUser } from './user-service.js';
        updateUser({ id: 1, name: "Jane", invalidField: true });
      `,
        output: `
        import { updateUser } from './user-service.js';
        updateUser({ id: 1, name: "Jane" });
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
              param: "invalidField",
              func: "updateUser",
              expected: "id, name",
            },
          },
        ],
      },
      {
        // Test deleteUser
        code: `
        import { deleteUser } from './user-service.js';
        deleteUser({ id: 1, force: true });
      `,
        output: `
        import { deleteUser } from './user-service.js';
        deleteUser({ id: 1 });
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
            data: { param: "force", func: "deleteUser", expected: "id" },
          },
        ],
      },
    ],
  },
);

console.log("✅ Individual function tests passed!");
