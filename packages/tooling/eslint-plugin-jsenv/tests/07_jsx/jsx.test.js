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
      name: "JSX components with matching props",
      code: `export const ValidComponent = () => {
  return <Toto a={1} />;
};

const Toto = ({ a }) => {
  console.log(a);
  return null;
};

export const ValidWithRest = () => {
  return <ComponentWithRest a={1} b={2} />;
};

const ComponentWithRest = ({ a, ...rest }) => {
  console.log(a, rest);
  return null;
};`,
    },
  ],
  invalid: [
    {
      name: "JSX components with extra props",
      code: `export const Tata = () => {
  return <Toto b={true} />;
};

const Toto = ({ a }) => {
  console.log(a);
  return null;
};

export const MultipleExtraProps = () => {
  return <Button label="Click" disabled={true} size="large" />;
};

const Button = ({ label }) => {
  return <button>{label}</button>;
};`,
      output: `export const Tata = () => {
  return <Toto  />;
};

const Toto = ({ a }) => {
  console.log(a);
  return null;
};

export const MultipleExtraProps = () => {
  return <Button label="Click"   />;
};

const Button = ({ label }) => {
  return <button>{label}</button>;
};`,
      errors: [
        {
          messageId: "unknownParam",
          data: { param: "b", func: "Toto" },
          type: "JSXAttribute",
        },
        {
          messageId: "unknownParam",
          data: { param: "disabled", func: "Button" },
          type: "JSXAttribute",
        },
        {
          messageId: "unknownParam",
          data: { param: "size", func: "Button" },
          type: "JSXAttribute",
        },
      ],
    },
  ],
});
