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

// Test multiple imports from the same file
ruleTester.run("no-unknown-params with multiple imports", noUnknownParamsRule, {
  valid: [
    {
      code: `
        import { createUser, updateUser, deleteUser } from './user-service.js';
        createUser({ name: "John", email: "john@example.com" });
        updateUser({ id: 1, name: "Jane" });
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
    },
  ],
  invalid: [
    {
      code: `
        import { createUser, updateUser, deleteUser } from './user-service.js';
        createUser({ name: "John", email: "john@example.com", password: "secret" });
        updateUser({ id: 1, name: "Jane", invalidField: true });
        deleteUser({ id: 1, force: true });
      `,
      output: `
        import { createUser, updateUser, deleteUser } from './user-service.js';
        createUser({ name: "John", email: "john@example.com" });
        updateUser({ id: 1, name: "Jane" });
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
          data: {
            param: "password",
            func: "createUser",
            expected: "name, email",
          },
        },
        {
          messageId: "superfluous_param",
          data: {
            param: "invalidField",
            func: "updateUser",
            expected: "id, name",
          },
        },
        {
          messageId: "superfluous_param",
          data: { param: "force", func: "deleteUser", expected: "id" },
        },
      ],
    },
  ],
});

console.log("✅ Multiple imports tests passed!");
