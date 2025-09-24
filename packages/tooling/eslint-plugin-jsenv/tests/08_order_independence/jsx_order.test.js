import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

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

ruleTester.run(
  "no-unknown-params - JSX order independence",
  noUnknownParamsRule,
  {
    valid: [
      {
        name: "JSX usage before component definition - valid",
      options: [{ reportAllUnknownParams: true }],        code: `function ValidApp() {
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
      options: [{ reportAllUnknownParams: true }],        code: `function App() {
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
  },
);

console.log("✅ JSX order independence tests passed!");
