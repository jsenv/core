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

// Test JSX props spreading through rest parameters
ruleTester.run("no-unknown-params JSX props spreading", noUnknownParamsRule, {
  valid: [
    {
      name: "parameter should not be flagged when spread through JSX props to component that uses it",
      options: [{ reportAllUnknownParams: true }],
      code: `
export const Main = ({ a, ...props }) => {
  if (a) {
    return null;
  }
  return <Text {...props} />;
};

const Text = ({ b }) => {
  return b;
};

export const Usage = () => {
  return <Main a="test" b="value" />;
};
      `,
    },
  ],
  invalid: [
    {
      options: [{ reportAllUnknownParams: true }],
      code: `
export const Component = (props) => {
  return <OtherComponent {...props} />;
};

const OtherComponent = ({ param }) => {
  return param;
};

export const Usage = () => {
  return <Component param="test" />;
};
      `,
      output: `
export const Component = (props) => {
  return <OtherComponent {...props} />;
};

const OtherComponent = ({ param }) => {
  return param;
};

export const Usage = () => {
  return <Component  />;
};
      `,
      errors: [
        {
          messageId: "not_found_param",
          data: {
            param: "param",
            func: "Component",
          },
        },
      ],
    },
  ],
});
