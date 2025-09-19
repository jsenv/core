import { RuleTester } from "eslint";
import rule from "../../lib/rules/no-unknown-params.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-unknown-params - rest renaming", rule, {
  valid: [
    {
      name: "rest param renamed and passed to function that uses the property",
      code: `const validRestRename = ({ a, ...rest }) => {
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
      code: `const invalidRestRename = ({ a, ...rest }) => {
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
          messageId: "not_found_param",
          data: { param: "d", func: "invalidRestRename" },
          type: "Property",
        },
      ],
    },
  ],
});
