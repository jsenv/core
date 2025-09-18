import { RuleTester } from "eslint";
import rule from "../../lib/rules/no-extra-params.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
});

// Simple test to debug the chaining issue
const testCode = `
// Call before definition with chaining
firstFunction({ a: 1, b: 2 }); // b should be valid via chaining

function firstFunction({ a, ...rest }) {
  return secondFunction(rest);
}

function secondFunction({ b }) {
  return b;
}
`;

console.log("Testing chaining with order independence...");

ruleTester.run("debug chaining", rule, {
  valid: [
    {
      code: testCode,
    },
  ],
  invalid: [],
});

console.log("✅ Chaining with order independence works!");
