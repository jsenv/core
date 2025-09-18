import { RuleTester } from "eslint";
import rule from "../../lib/rules/no-extra-params.js";

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

const simpleInvalidCode = `
const Toto = ({ a }) => {
  console.log(a);
  return null;
};

export const Tata = () => {
  return <Toto b={true} />;
};
`;

ruleTester.run("no-extra-params - JSX simple", rule, {
  valid: [],
  invalid: [
    {
      name: "simple JSX with extra prop",
      code: simpleInvalidCode,
      errors: [
        {
          messageId: "extraParam",
          data: { param: "b", func: "Toto" },
          type: "JSXAttribute",
        },
      ],
    },
  ],
});
