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

ruleTester.run("no-unknown-params - JSX components", rule, {
  valid: [
    {
      name: "JSX component with exact matching props",
      code: `const Toto = ({ a }) => {
  console.log(a);
  return null;
};

export const ValidComponent = () => {
  return <Toto a={1} />;
};`,
    },
    {
      name: "JSX component with rest parameters accepting extra props",
      code: `const ComponentWithRest = ({ a, ...rest }) => {
  console.log(a, rest);
  return null;
};

export const ValidWithRest = () => {
  return <ComponentWithRest a={1} b={2} />;
};`,
    },
  ],
  invalid: [
    {
      name: "JSX component with single unknown prop",
      code: `const Toto = ({ a }) => {
  console.log(a);
  return null;
};

export const App = () => {
  return <Toto b={true} />;
};`,
      output: `const Toto = ({ a }) => {
  console.log(a);
  return null;
};

export const App = () => {
  return <Toto  />;
};`,
      errors: [
        {
          messageId: "not_found_param",
          data: { param: "b", func: "Toto" },
          type: "JSXAttribute",
        },
      ],
    },
    {
      name: "JSX component with multiple unknown props",
      code: `const Button = ({ label }) => {
  return <button>{label}</button>;
};

export const App = () => {
  return <Button label="Click" disabled={true} size="large" />;
};`,
      output: `const Button = ({ label }) => {
  return <button>{label}</button>;
};

export const App = () => {
  return <Button label="Click"   />;
};`,
      errors: [
        {
          messageId: "not_found_param",
          data: { param: "disabled", func: "Button" },
          type: "JSXAttribute",
        },
        {
          messageId: "not_found_param",
          data: { param: "size", func: "Button" },
          type: "JSXAttribute",
        },
      ],
    },
  ],
});
