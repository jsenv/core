import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
  },
});

// Test parameter shortening with a function that has exactly 7 parameters
// This should trigger the shortening (>5 params)
ruleTester.run(
  "no-unknown-params parameter shortening working",
  noUnknownParamsRule,
  {
    valid: [],
    invalid: [
      {
        code: `
        function sevenParamFunction({ a, b, c, d, e, f, g }) {
          return { a, b, c, d, e, f, g };
        }
        
        sevenParamFunction({
          a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7,
          invalidParam: "should show truncated list"
        });
      `,
        output: `
        function sevenParamFunction({ a, b, c, d, e, f, g }) {
          return { a, b, c, d, e, f, g };
        }
        
        sevenParamFunction({
          a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7
        });
      `,
        filename: "/test.js",
        errors: [
          {
            message: "invalidParam not found in sevenParamFunction()",
            type: "Property",
          },
        ],
      },
    ],
  },
);
