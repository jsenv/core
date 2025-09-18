import { RuleTester } from "eslint";
import rule from "../lib/rules/no-extra-params.js";

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-extra-params", rule, {
  valid: [
    // Function uses all provided parameters
    {
      code: `
        function foo({ a, b }) {
          console.log(a, b);
        }
        foo({ a: 1, b: 2 });
      `,
    },
    // Function uses only the parameter it expects
    {
      code: `
        function foo({ a }) {
          console.log(a);
        }
        foo({ a: 1 });
      `,
    },
    // Arrow function with destructuring
    {
      code: `
        const foo = ({ a, b }) => {
          return a + b;
        };
        foo({ a: 1, b: 2 });
      `,
    },
    // No parameters at all
    {
      code: `
        function foo() {
          return "hello";
        }
        foo();
      `,
    },
  ],

  invalid: [
    // Extra parameter 'b' is not used in function definition
    {
      code: `
        function foo({ a }) {
          console.log(a);
        }
        foo({ a: 1, b: 2 });
      `,
      errors: [
        {
          messageId: "extraParam",
          data: { param: "b", func: "foo" },
          type: "Property",
        },
      ],
    },
    // Multiple extra parameters
    {
      code: `
        function foo({ a }) {
          console.log(a);
        }
        foo({ a: 1, b: 2, c: 3 });
      `,
      errors: [
        {
          messageId: "extraParam",
          data: { param: "b", func: "foo" },
          type: "Property",
        },
        {
          messageId: "extraParam",
          data: { param: "c", func: "foo" },
          type: "Property",
        },
      ],
    },
    // Arrow function with extra params
    {
      code: `
        const bar = ({ x }) => x * 2;
        bar({ x: 5, y: 10 });
      `,
      errors: [
        {
          messageId: "extraParam",
          data: { param: "y", func: "bar" },
          type: "Property",
        },
      ],
    },
  ],
});
