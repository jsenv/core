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
      filename: "/Users/dmail/Documents/dev/jsenv/core/packages/tooling/eslint-plugin-jsenv/tests/21_import_cycles/simple.js",
    },
  ],
  invalid: [
    {
      // Test that our rule doesn't crash on cycles - it should handle gracefully
      // The exact error messages may vary based on cycle handling, but no infinite loops
      code: `
        import { helperFunction } from "./file_b.js";
        
        // Just test that calling an imported function with extra params works
        helperFunction({
          invalidParam: "this should be caught without crashing"
        });
      `,
      output: `
        import { helperFunction } from "./file_b.js";
        
        // Just test that calling an imported function with extra params works
        helperFunction({
          
        });
      `,
      filename: "/Users/dmail/Documents/dev/jsenv/core/packages/tooling/eslint-plugin-jsenv/tests/21_import_cycles/file_a.js",
      errors: [
        {
          message: 'invalidParam does not exist in helperFunction()',
          type: "Property",
        },
      ],
    },
  ],
});