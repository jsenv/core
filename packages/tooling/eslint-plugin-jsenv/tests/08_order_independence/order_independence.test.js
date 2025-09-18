import { RuleTester } from "eslint";
import rule from "../../lib/rules/no-extra-params.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

ruleTester.run("no-extra-params order independence", rule, {
  valid: [
    // Function call before function definition - valid usage
    {
      code: `
        // Call before definition
        doSomething({ name: "test" });

        function doSomething({ name }) {
          console.log(name);
        }
      `,
    },
    // JSX usage before component definition - valid
    {
      code: `
        function App() {
          return <MyComponent title="Hello" />;
        }

        function MyComponent({ title }) {
          return <div>{title}</div>;
        }
      `,
    },
    // Hoisted function call - valid
    {
      code: `
        hoistedCall({ name: "test" });

        function hoistedCall({ name }) {
          console.log(name);
        }
      `,
    },
  ],
  invalid: [
    // Function call before function definition - with extra param
    {
      code: `
        // Call before definition with extra param
        doSomething({ name: "test", extra: "value" });

        function doSomething({ name }) {
          console.log(name);
        }
      `,
      errors: [
        {
          messageId: "extraParam",
          data: { param: "extra", func: "doSomething" },
        },
      ],
    },
    // JSX usage before component definition - with extra prop
    {
      code: `
        function App() {
          return <MyComponent title="Hello" extra="shouldWarn" />;
        }

        function MyComponent({ title }) {
          return <div>{title}</div>;
        }
      `,
      errors: [
        {
          messageId: "extraParam",
          data: { param: "extra", func: "MyComponent" },
        },
      ],
    },
    // Multiple calls before definition
    {
      code: `
        test({ a: 1, b: 2 }); // b is extra
        test({ a: 1, c: 3 }); // c is extra

        function test({ a }) {
          return a;
        }
      `,
      errors: [
        {
          messageId: "extraParam",
          data: { param: "b", func: "test" },
        },
        {
          messageId: "extraParam",
          data: { param: "c", func: "test" },
        },
      ],
    },
  ],
});

console.log("✅ Order independence tests passed!");
