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
      name: "JSX component with unknown prop",
      options: [{ reportAllUnknownParams: true }],
      code: `const Component = ({ used }) => {
  return <div>{used}</div>;
};

export const Usage = () => {
  return <Component used="value" unused="bad" />;
};`,
      output: `const Component = ({ used }) => {
  return <div>{used}</div>;
};

export const Usage = () => {
  return <Component used="value"  />;
};`,
      errors: [
        {
          messageId: "not_found_param_with_suggestions",
          data: {
            param: "unused",
            func: "Component",
            suggestions: "used",
          },
          suggestions: [
            {
              desc: "Remove 'unused'",
              output: `const Component = ({ used }) => {
  return <div>{used}</div>;
};

export const Usage = () => {
  return <Component used="value"  />;
};`,
            },
            {
              desc: "Rename 'unused' to 'used'",
              output: `const Component = ({ used }) => {
  return <div>{used}</div>;
};

export const Usage = () => {
  return <Component used="value" used="bad" />;
};`,
            },
          ],
        },
      ],
    },
    {
      name: "JSX spreading should work with 2-level chain",
      options: [{ reportAllUnknownParams: true }],
      code: `const FormattedText = (props) => {
  return <Text {...props} />;
};
const Text = ({ a, b }) => {
  return <span>{a} {b}</span>;
};

export const Usage = () => {
  return <FormattedText a="hello" b="world" c="unused" />;
};`,
      output: `const FormattedText = (props) => {
  return <Text {...props} />;
};
const Text = ({ a, b }) => {
  return <span>{a} {b}</span>;
};

export const Usage = () => {
  return <FormattedText a="hello" b="world"  />;
};`,
      errors: [
        {
          messageId: "not_found_param",
          data: {
            param: "c",
            func: "FormattedText",
          },
          suggestions: [
            {
              desc: "Remove 'c'",
              output: `const FormattedText = (props) => {
  return <Text {...props} />;
};
const Text = ({ a, b }) => {
  return <span>{a} {b}</span>;
};

export const Usage = () => {
  return <FormattedText a="hello" b="world"  />;
};`,
            },
          ],
        },
      ],
    },
  ],
});
