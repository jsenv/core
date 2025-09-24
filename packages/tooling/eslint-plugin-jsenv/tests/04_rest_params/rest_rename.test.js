import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-unknown-params - rest renaming", noUnknownParamsRule, {
  valid: [
    {
      name: "rest param renamed and passed to function that uses the property",
      options: [{ reportAllUnknownParams: true }],      code: `const validRestRename = ({ a, ...rest }) => {
  console.log(a);
  const titi = rest;
  targetFunction(titi);
};

const targetFunction = ({ c }) => {
  console.log(c);
};

validRestRename({ a: 1, c: true });`,
    },
  ],
  invalid: [
    {
      name: "rest param renamed but property not used by target function",
      options: [{ reportAllUnknownParams: true }],      code: `const invalidRestRename = ({ a, ...rest }) => {
  console.log(a);
  const titi = rest;
  targetFunction(titi);
};

const targetFunction = ({ c }) => {
  console.log(c);
};

invalidRestRename({ a: 1, d: true });`,
      output: `const invalidRestRename = ({ a, ...rest }) => {
  console.log(a);
  const titi = rest;
  targetFunction(titi);
};

const targetFunction = ({ c }) => {
  console.log(c);
};

invalidRestRename({ a: 1 });`,
      errors: [
        {
          messageId: "not_found_param_chain_with_suggestions",
          data: {
            param: "d",
            firstFunc: "invalidRestRename",
            secondFunc: "targetFunction",
            available: "a, c",
          },
          type: "Property",
        },
      ],
    },
  ],
});
