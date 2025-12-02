import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";
import { fileURLToPath } from "node:url";

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
      filename: import.meta.resolve("./fixtures/simple.js"),
    },
  ],
  invalid: [
    {
      // Test that we can analyze function parameters even with import cycles
      // Now that we parse files without recursively following imports, this should work
      options: [{ reportAllUnknownParams: true }],
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
      filename: fileURLToPath(import.meta.resolve("./fixtures/file_a.js")),
      errors: [
        {
          message: `"invalidParam" not found in "helperFunction" params (defined in ./file_b.js)`,
          type: "Property",
        },
      ],
    },
  ],
});
