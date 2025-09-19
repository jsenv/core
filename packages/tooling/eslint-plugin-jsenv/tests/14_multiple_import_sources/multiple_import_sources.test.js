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

// Test multiple import sources - importing from different files
ruleTester.run(
  "no-unknown-params multiple import sources",
  noUnknownParamsRule,
  {
    valid: [
      {
        // Valid usage from multiple import sources
        code: `
        import { createUser, updateUser } from './user-ops.js';
        import { validateEmail, validateData } from './validators.js';
        
        createUser({ name: "John", email: "john@test.com", role: "admin" });
        updateUser({ id: 1, updates: { name: "Jane" } });
        validateEmail({ email: "test@example.com" });
        validateData({ data: {}, schema: "user" });
      `,
        filename: mainFilePath,
      },
    ],
    invalid: [
      {
        // Invalid parameters from multiple sources
        code: `
        import { createUser, updateUser } from './user-ops.js';
        import { validateEmail, validateData } from './validators.js';
        
        createUser({ name: "John", email: "john@test.com", role: "admin", age: 25 });
        updateUser({ id: 1, updates: { name: "Jane" }, force: true });
        validateEmail({ email: "test@example.com", strict: true });
        validateData({ data: {}, schema: "user", throwOnError: false });
      `,
        output: `
        import { createUser, updateUser } from './user-ops.js';
        import { validateEmail, validateData } from './validators.js';
        
        createUser({ name: "John", email: "john@test.com", role: "admin" });
        updateUser({ id: 1, updates: { name: "Jane" } });
        validateEmail({ email: "test@example.com" });
        validateData({ data: {}, schema: "user" });
      `,
        filename: mainFilePath,
        errors: [
          {
            message:
              "age is superfluous. createUser() (defined in ./user-ops.js) only accepts: name, email, role.",
            type: "Property",
          },
          {
            message:
              "force is superfluous. updateUser() (defined in ./user-ops.js) only accepts: id, updates.",
            type: "Property",
          },
          {
            message:
              "strict does not exist in validateEmail() (defined in ./validators.js)",
            type: "Property",
          },
          {
            message:
              "throwOnError is superfluous. validateData() (defined in ./validators.js) only accepts: data, schema.",
            type: "Property",
          },
        ],
      },
    ],
  },
);
