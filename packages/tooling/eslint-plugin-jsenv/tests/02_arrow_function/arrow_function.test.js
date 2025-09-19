import { RuleTester } from "eslint";
import rule from "../../lib/rules/no-unknown-params.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-unknown-params - arrow function", rule, {
  valid: [
    {
      name: "arrow function uses all parameters",
      code: `const bar = ({ x }) => x * 2;
bar({ x: 5 });`,
    },
  ],
  invalid: [
    {
      name: "arrow function with extra parameter",
      code: `const bar = ({ x }) => x * 2;
bar({ x: 5, y: 10 });`,
      output: `const bar = ({ x }) => x * 2;
bar({ x: 5 });`,
      errors: [
        {
          messageId: "unknownParam",
          data: { param: "y", func: "bar" },
          type: "Property",
        },
      ],
    },
  ],
});
