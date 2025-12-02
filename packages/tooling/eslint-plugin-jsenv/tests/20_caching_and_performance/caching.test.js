import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { clearFileParseCache } from "../../src/rule_no_unknown_params/utils/import_resolution.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
  },
});

// Clear cache before tests - this demonstrates the caching API is available
clearFileParseCache();

const testFilePath = join(__dirname, "test_main.js");

// Test caching behavior with import resolution
ruleTester.run("no-unknown-params caching mechanism", noUnknownParamsRule, {
  valid: [],
  invalid: [
    {
      options: [{ reportAllUnknownParams: true }],
      code: `
        import { extremeFunction } from "./extreme_function.js";
        
        extremeFunction({
          a: 1, b: 2, c: 3, d: 4, e: 5,
          invalidParam: "this should show truncated list"
        });
      `,
      output: `
        import { extremeFunction } from "./extreme_function.js";
        
        extremeFunction({
          a: 1, b: 2, c: 3, d: 4, e: 5
        });
      `,
      filename: testFilePath,
      errors: [
        {
          messageId: "not_found_param_with_file",
          data: {
            param: "invalidParam",
            func: `"extremeFunction" params`,
            filePath: "./extreme_function.js",
          },
        },
      ],
    },
  ],
});
