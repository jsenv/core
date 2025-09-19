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

// Test just updateUser to see if it's a specific function issue
ruleTester.run("no-unknown-params updateUser only", noUnknownParamsRule, {
  valid: [],
  invalid: [
    {
      // Test updateUser only - expecting 'not_found_param' based on error
      code: `
        import { updateUser } from './user-service.js';
        updateUser({ id: 1, name: "Jane", invalidField: true });
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
          messageId: "not_found_param",
          data: { param: "invalidField", func: "updateUser" },
        },
      ],
    },
  ],
});

console.log("✅ UpdateUser test passed!");
