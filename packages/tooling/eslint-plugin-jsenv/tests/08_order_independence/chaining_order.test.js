import { RuleTester } from "eslint";
import rule from "../../lib/rules/no-unknown-params.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-unknown-params - chaining order independence", rule, {
  valid: [
    {
      name: "function chaining before definition - valid usage",
      code: `processValidData({ name: "test", age: 25 });

function processValidData({ name, ...rest }) {
  return handleValidRest({ ...rest });
}

function handleValidRest({ age }) {
  return age;
}`,
    },
  ],
  invalid: [
    {
      name: "function chaining before definition - with unused param",
      code: `processData({ name: "test", age: 25, unused: "value" });

function processData({ name, ...rest }) {
  return handleRest({ ...rest });
}

function handleRest({ age }) {
  return age;
}`,
      output: `processData({ name: "test", age: 25 });

function processData({ name, ...rest }) {
  return handleRest({ ...rest });
}

function handleRest({ age }) {
  return age;
}`,
      errors: [
        {
          messageId: "notFoundParam",
          data: { param: "unused", func: "processData" },
        },
      ],
    },
  ],
});

console.log("✅ Chaining order independence tests passed!");
