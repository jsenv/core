import { RuleTester } from "eslint";
import rule from "../../lib/rules/no-extra-params.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
});

// Test with function definitions first, then usage
const testCode1 = `
function firstFunction({ a, ...rest }) {
  return secondFunction(rest);
}

function secondFunction({ b }) {
  return b;
}

firstFunction({ a: 1, b: 2 }); // b should be valid
`;

// Test with usage first, then function definitions
const testCode2 = `
firstFunction({ a: 1, b: 2 }); // b should be valid

function firstFunction({ a, ...rest }) {
  return secondFunction(rest);
}

function secondFunction({ b }) {
  return b;
}
`;

console.log("Testing order impact on chaining...");

try {
  console.log("Testing definitions first...");
  ruleTester.run("definitions first", rule, {
    valid: [{ code: testCode1 }],
    invalid: [],
  });
  console.log("✅ Definitions first works!");
} catch (error) {
  console.log("❌ Definitions first failed:", error.message);
}

try {
  console.log("Testing usage first...");
  ruleTester.run("usage first", rule, {
    valid: [{ code: testCode2 }],
    invalid: [],
  });
  console.log("✅ Usage first works!");
} catch (error) {
  console.log("❌ Usage first failed:", error.message);
}
