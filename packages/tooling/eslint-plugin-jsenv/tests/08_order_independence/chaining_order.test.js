import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run(
  "no-unknown-params - chaining order independence",
  noUnknownParamsRule,
  {
    valid: [
      {
        name: "function chaining before definition - valid usage",
        options: [{ reportAllUnknownParams: true }],
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
        options: [{ reportAllUnknownParams: true }],
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
            messageId: "not_found_param_chain_with_suggestions",
            data: {
              param: "unused",
              firstFunc: `"processData" params`,
              secondFunc: `"handleRest" params`,
              available: "name, age",
            },
          },
        ],
      },
    ],
  },
);

console.log("✅ Chaining order independence tests passed!");
