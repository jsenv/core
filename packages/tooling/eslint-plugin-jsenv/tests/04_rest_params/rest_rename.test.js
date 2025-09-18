import { RuleTester } from "eslint";
import rule from "../../lib/rules/no-extra-params.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

const validRestRenamed = `
const validRestRename = ({ a, ...rest }) => {
  console.log(a);
  const titi = rest;
  targetFunction(titi);
};

const targetFunction = ({ c }) => {
  console.log(c);
};

validRestRename({ a: 1, c: true });
`;

const invalidRestRenamed = `
const invalidRestRename = ({ a, ...rest }) => {
  console.log(a);
  const titi = rest;
  targetFunction(titi);
};

const targetFunction = ({ c }) => {
  console.log(c);
};

invalidRestRename({ a: 1, d: true });
`;

ruleTester.run("no-extra-params - rest renaming", rule, {
  valid: [
    {
      name: "rest param renamed and passed to function that uses the property",
      code: validRestRenamed,
    },
  ],
  invalid: [
    {
      name: "rest param renamed but property not used by target function",
      code: invalidRestRenamed,
      errors: [
        {
          messageId: "extraParam",
          data: { param: "d", func: "invalidRestRename" },
          type: "Property",
        },
      ],
    },
  ],
});
