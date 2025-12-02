import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

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

ruleTester.run("no-unknown-params - order independence", noUnknownParamsRule, {
  valid: [
    {
      name: "function call before definition - valid usage",
      options: [{ reportAllUnknownParams: true }],
      code: `doValidSomething({ name: "test" });

function doValidSomething({ name }) {
  console.log(name);
}`,
    },
  ],
  invalid: [
    {
      name: "function call before definition - with extra param",
      options: [{ reportAllUnknownParams: true }],
      code: `doSomething({ name: "test", extra: "value" });

function doSomething({ name }) {
  console.log(name);
}`,
      output: `doSomething({ name: "test" });

function doSomething({ name }) {
  console.log(name);
}`,
      errors: [
        {
          messageId: "not_found_param",
          data: { param: "extra", func: `"doSomething" params` },
        },
      ],
    },
  ],
});

console.log("✅ Order independence tests passed!");
