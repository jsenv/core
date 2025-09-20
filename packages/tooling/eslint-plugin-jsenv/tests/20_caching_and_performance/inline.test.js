import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
  },
});

// Test parameter shortening with inline function first
ruleTester.run("no-unknown-params inline function", noUnknownParamsRule, {
  valid: [],
  invalid: [
    {
      code: `
        function extremeFunction({ 
          a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u, v, w, x, y, z,
          aa, bb, cc, dd, ee, ff
        }) {
          return { a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u, v, w, x, y, z, aa, bb, cc, dd, ee, ff };
        }
        
        extremeFunction({
          a: 1, b: 2, c: 3, d: 4, e: 5,
          invalidParam: "this should show truncated list"
        });
      `,
      filename: "/test.js",
      output: `
        function extremeFunction({ 
          a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u, v, w, x, y, z,
          aa, bb, cc, dd, ee, ff
        }) {
          return { a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u, v, w, x, y, z, aa, bb, cc, dd, ee, ff };
        }
        
        extremeFunction({
          a: 1, b: 2, c: 3, d: 4, e: 5
        });
      `,
      errors: [
        {
          message: "invalidParam not found in extremeFunction()",
          type: "Property",
        },
      ],
    },
  ],
});
