import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-unknown-params - function basic", noUnknownParamsRule, {
  valid: [
    {
      name: "function uses all parameters",
      code: `function foo({ a }) {
  console.log(a);
}
foo({ a: 1 });`,
    },
  ],
  invalid: [
    {
      name: "function with extra parameter",
      options: [{ reportAllUnknownParams: true }],
      code: `function foo({ a }) {
  console.log(a);
}
foo({ a: 1, b: 2 });`,
      output: `function foo({ a }) {
  console.log(a);
}
foo({ a: 1 });`,
      errors: [
        {
          messageId: "not_found_param",
          data: { param: "b", func: `"foo" params` },
          type: "Property",
        },
      ],
    },
  ],
});
