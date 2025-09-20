import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-unknown-params - function chaining", noUnknownParamsRule, {
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
          messageId: "not_found_param_chain_with_suggestions",
          data: {
            param: "c",
            firstFunc: "toto",
            secondFunc: "tata",
            available: "a, b",
          },
          type: "Property",
        },
      ],
    },
  ],
});
