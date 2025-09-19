import { RuleTester } from "eslint";
import rule from "../../lib/rules/no-unknown-params.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-unknown-params - function basic", rule, {
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
          messageId: "unknownParam",
          data: { param: "b", func: "foo" },
          type: "Property",
        },
      ],
    },
  ],
});
