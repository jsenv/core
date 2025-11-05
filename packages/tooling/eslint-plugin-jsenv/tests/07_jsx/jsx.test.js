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

ruleTester.run("no-unknown-params - JSX components", noUnknownParamsRule, {
  valid: [
    {
      name: "JSX component with exact matching props",
      options: [{ reportAllUnknownParams: true }],
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
      options: [{ reportAllUnknownParams: true }],
      code: `const ComponentWithRest = ({ a, ...rest }) => {
  console.log(a, rest);
  return null;
};

export const ValidWithRest = () => {
  return <ComponentWithRest a={1} b={2} />;
};`,
    },
    {
      name: "JSX component with React built-in props (key, ref) should be ignored",
      options: [{ reportAllUnknownParams: true }],
      code: `const Button = ({ label }) => {
  return <button>{label}</button>;
};

export const App = () => {
  return <Button key="btn1" ref={null} label="Click" />;
};`,
    },
    {
      name: "JSX component with children prop should be ignored",
      options: [{ reportAllUnknownParams: true }],
      code: `const Container = ({ className }) => {
  return <div className={className} />;
};

export const App = () => {
  return <Container className="wrapper" children={<span>content</span>} />;
};`,
    },
  ],
  invalid: [
    {
      name: "JSX component with single unknown prop",
      options: [{ reportAllUnknownParams: true }],
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
      options: [{ reportAllUnknownParams: true }],
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
    {
      name: "JSX component with mixed valid, invalid, and ignored props",
      options: [{ reportAllUnknownParams: true }],
      code: `const Button = ({ label, className }) => {
  return <button className={className}>{label}</button>;
};

export const App = () => {
  return <Button key="btn1" ref={null} label="Click" unknownProp="test" />;
};`,
      output: `const Button = ({ label, className }) => {
  return <button className={className}>{label}</button>;
};

export const App = () => {
  return <Button key="btn1" ref={null} label="Click"  />;
};`,
      errors: [
        {
          messageId: "not_found_param",
          data: { param: "unknownProp", func: "Button" },
          type: "JSXAttribute",
        },
      ],
    },
    {
      name: "JSX component with no props receiving unknown props",
      options: [{ reportAllUnknownParams: true }],
      code: `const ComponentWithoutProps = () => {
  return null;
};

export const App = () => {
  return <ComponentWithoutProps extra="value" another="value2" />;
};`,
      output: `const ComponentWithoutProps = () => {
  return null;
};

export const App = () => {
  return <ComponentWithoutProps   />;
};`,
      errors: [
        {
          messageId: "not_found_param",
          data: { param: "extra", func: "ComponentWithoutProps" },
          type: "JSXAttribute",
        },
        {
          messageId: "not_found_param",
          data: { param: "another", func: "ComponentWithoutProps" },
          type: "JSXAttribute",
        },
      ],
    },
    {
      name: "JSX component with spread props and unknown prop at end of chain",
      options: [{ reportAllUnknownParams: true }],
      code: `const Some = (props) => {
  return <Thing {...props} />;
};
const Thing = ({ knownProp }) => {
  return <div>{knownProp}</div>;
};

export const App = () => {
  return <Some knownProp="value" extra="value" />;
};`,
      output: `const Some = (props) => {
  return <Thing {...props} />;
};
const Thing = ({ knownProp }) => {
  return <div>{knownProp}</div>;
};

export const App = () => {
  return <Some knownProp="value"  />;
};`,
      errors: [
        {
          messageId: "not_found_param",
          data: { param: "extra", func: "Some" },
          type: "JSXAttribute",
        },
      ],
    },
  ],
});
