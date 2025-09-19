import { RuleTester } from "eslint";
import rule from "../../lib/rules/no-unknown-params.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-unknown-params - function chaining", rule, {
  valid: [
    {
      name: "parameter used through chaining with spread operator",
      code: `const toto = ({ a, ...rest }) => {
  console.log(a);
  tata({ ...rest, b: true });
};

const tata = ({ b }) => {
  console.log(b);
};

toto({ a: true, b: false });`,
    },
  ],
  invalid: [
    {
      name: "parameter not used in chaining",
      code: `const toto = ({ a, ...rest }) => {
  console.log(a);
  tata({ ...rest, b: true });
};

const tata = ({ b }) => {
  console.log(b);
};

toto({ a: true, c: true });`,
      output: `const toto = ({ a, ...rest }) => {
  console.log(a);
  tata({ ...rest, b: true });
};

const tata = ({ b }) => {
  console.log(b);
};

toto({ a: true });`,
      errors: [
        {
          messageId: "unknownParam",
          data: { param: "c", func: "toto" },
          type: "Property",
        },
      ],
    },
  ],
});
