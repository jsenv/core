import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";
import { clearFileParseCache } from "../../src/rule_no_unknown_params/utils/import_resolution.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
  },
});

// Clear cache before tests - this demonstrates the caching API is available
clearFileParseCache();

// Test caching behavior with import resolution
ruleTester.run("no-unknown-params caching mechanism", noUnknownParamsRule, {
  valid: [],
  invalid: [
    {
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
      filename:
        "/Users/dmail/Documents/dev/jsenv/core/packages/tooling/eslint-plugin-jsenv/tests/20_caching_and_performance/test.js",
      errors: [
        {
          message:
            "invalidParam not found in extremeFunction() (defined in ./extreme_function.js)",
          type: "Property",
        },
      ],
    },
  ],
});
