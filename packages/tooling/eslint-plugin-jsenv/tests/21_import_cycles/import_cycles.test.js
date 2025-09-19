import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
  },
});

// Test that import cycles don't cause infinite loops in our rule
ruleTester.run("no-unknown-params with import cycles", noUnknownParamsRule, {
  valid: [
    {
      code: `
        export function mainFunction({ id, name, data }) {
          return { id, name, data };
        }
        
        // This call should work - testing inline function (no imports)
        mainFunction({
          id: 1,
          name: "test",
          data: { key: "value" }
        });
      `,
      filename:
        "/Users/dmail/Documents/dev/jsenv/core/packages/tooling/eslint-plugin-jsenv/tests/21_import_cycles/simple.js",
    },
  ],
  invalid: [
    {
      // Test that we can analyze function parameters even with import cycles
      // Now that we parse files without recursively following imports, this should work
      code: `
        import { helperFunction } from "./file_b.js";
        
        // Test calling imported function with correct params + invalid param
        helperFunction({
          userId: 1,
          processData: "test", 
          options: { key: "value" },
          invalidParam: "should be caught as superfluous"
        });
      `,
      output: `
        import { helperFunction } from "./file_b.js";
        
        // Test calling imported function with correct params + invalid param
        helperFunction({
          userId: 1,
          processData: "test", 
          options: { key: "value" }
        });
      `,
      filename:
        "/Users/dmail/Documents/dev/jsenv/core/packages/tooling/eslint-plugin-jsenv/tests/21_import_cycles/file_a.js",
      errors: [
        {
          message:
            "invalidParam is superfluous. helperFunction() only accepts: userId, processData, options.",
          type: "Property",
        },
      ],
    },
  ],
});
