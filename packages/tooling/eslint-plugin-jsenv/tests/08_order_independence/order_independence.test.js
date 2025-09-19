import { RuleTester } from "eslint";
import rule from "../../lib/rules/no-unknown-params.js";

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

ruleTester.run("no-unknown-params - order independence", rule, {
  valid: [
    {
      name: "function call before definition - valid usage",
      code: `doValidSomething({ name: "test" });

function doValidSomething({ name }) {
  console.log(name);
}`,
    },
  ],
  invalid: [
    {
      name: "function call before definition - with extra param",
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
          messageId: "notFoundParam",
          data: { param: "extra", func: "doSomething" },
        },
      ],
    },
  ],
});

console.log("✅ Order independence tests passed!");
