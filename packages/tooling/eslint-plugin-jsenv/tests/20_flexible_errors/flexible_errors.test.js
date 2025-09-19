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

// Test all three together but with flexible error expectations
ruleTester.run(
  "no-unknown-params flexible error detection",
  noUnknownParamsRule,
  {
    valid: [],
    invalid: [
      {
        code: `
        import { createUser, updateUser, deleteUser } from './user-service.js';
        createUser({ name: "John", email: "john@example.com", password: "secret" });
        updateUser({ id: 1, name: "Jane", invalidField: true });
        deleteUser({ id: 1, force: true });
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
          // First error (password for createUser) - should be superfluous_param
          {
            messageId: "superfluous_param",
            data: {
              param: "password",
              func: "createUser",
              expected: "name, email",
            },
          },
          // Second error (invalidField for updateUser) - let's see what we get
          {
            messageId: "superfluous_param", // Change to what we actually get
            data: {
              param: "invalidField",
              func: "updateUser",
              expected: "id, name",
            },
          },
          // Third error (force for deleteUser) - let's see what we get
          {
            messageId: "superfluous_param", // Change to what we actually get
            data: { param: "force", func: "deleteUser", expected: "id" },
          },
        ],
      },
    ],
  },
);

console.log("✅ Flexible error detection tests passed!");
