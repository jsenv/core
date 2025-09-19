import { RuleTester } from "eslint";
import rule from "../../lib/rules/no-unknown-params.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

ruleTester.run("no-unknown-params - JSX order independence", rule, {
  valid: [
    {
      name: "JSX usage before component definition - valid",
      code: `function ValidApp() {
  return <ValidComponent title="Hello" />;
}

function ValidComponent({ title }) {
  return <div>{title}</div>;
}`,
    },
  ],
  invalid: [
    {
      name: "JSX usage before component definition - with extra prop",
      code: `function App() {
  return <MyComponent title="Hello" extra="shouldWarn" />;
}

function MyComponent({ title }) {
  return <div>{title}</div>;
}`,
      output: `function App() {
  return <MyComponent title="Hello"  />;
}

function MyComponent({ title }) {
  return <div>{title}</div>;
}`,
      errors: [
        {
          messageId: "not_found_param",
          data: { param: "extra", func: "MyComponent" },
        },
      ],
    },
  ],
});

console.log("✅ JSX order independence tests passed!");
