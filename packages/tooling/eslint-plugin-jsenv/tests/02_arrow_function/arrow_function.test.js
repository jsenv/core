import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-unknown-params - arrow function", noUnknownParamsRule, {
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
          messageId: "not_found_param",
          data: { param: "y", func: "bar" },
          type: "Property",
        },
      ],
    },
  ],
});
