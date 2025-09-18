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

ruleTester.run("no-extra-params complex order independence", rule, {
  valid: [
    // Complex function chaining with order independence
    {
      code: `
        // Calls before definitions
        firstFunction({ a: 1, b: 2, c: 3 }); // b and c should be valid via chaining
        
        function firstFunction({ a, ...rest }) {
          return secondFunction(rest);
        }
        
        function secondFunction({ b, ...remainingRest }) {
          return thirdFunction(remainingRest);
        }
        
        function thirdFunction({ c }) {
          return c;
        }
      `,
    },
    // JSX with chaining and order independence
    {
      code: `
        function App() {
          return <ComponentA title="Hello" subtitle="World" theme="dark" />;
        }

        function ComponentA({ title, ...rest }) {
          return <ComponentB {...rest} />;
        }

        function ComponentB({ subtitle, ...rest }) {
          return <ComponentC {...rest} />;
        }

        function ComponentC({ theme }) {
          return <div className={theme}></div>;
        }
      `,
    },
  ],
  invalid: [
    // Order independence with unused parameter in chain
    {
      code: `
        // Call before definition with truly unused param
        processData({ name: "test", age: 25, unused: "value" });

        function processData({ name, ...rest }) {
          return handleRest(rest);
        }

        function handleRest({ age }) {
          return age;
        }
        // 'unused' is not handled in the chain
      `,
      errors: [
        {
          messageId: "extraParam",
          data: { param: "unused", func: "processData" },
        },
      ],
    },
  ],
});

console.log("✅ Complex order independence tests passed!");
