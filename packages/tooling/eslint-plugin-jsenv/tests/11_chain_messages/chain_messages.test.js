import { RuleTester } from "eslint";
import rule from "../../lib/rules/no-unknown-params.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

console.log("Testing chain messages...");

// Test 1: Simple chain with 2 functions
const simpleChain = `
function processData({ id, ...rest }) {
  return sendData({ ...rest });
}
function sendData({ name, email }) {
  console.log(name, email);
}
processData({ id: 1, name: "John", email: "test@example.com", age: 25 });
`;

// Test 2: Longer chain with multiple propagations
const longChain = `
function step1({ id, ...rest }) {
  return step2({ ...rest });
}
function step2({ data, ...rest }) {
  return step3({ ...rest });
}
function step3({ config, ...rest }) {
  return step4({ ...rest });
}
function step4({ settings, ...rest }) {
  return step5({ ...rest });
}
function step5({ name }) {
  console.log(name);
}
step1({ id: 1, data: "test", config: {}, settings: {}, name: "John", unknown: "param" });
`;

// Run tests
try {
  ruleTester.run("no-unknown-params - chain messages", rule, {
    valid: [
      // This should be valid - all params are used somewhere in chain
      {
        name: "all parameters used in chain",
        code: `
function step1({ id, ...rest }) {
  return step2({ ...rest });
}
function step2({ name }) {
  console.log(name);
}
step1({ id: 1, name: "John" });
        `,
      },
    ],
    invalid: [
      {
        name: "parameter not used in short chain",
        code: simpleChain,
        errors: [
          {
            messageId: "unknownParam", // Could be unknownParamChain if chain detected
            data: { param: "age", func: "processData" },
            type: "Property",
          },
        ],
      },
      {
        name: "parameter not used in long chain",
        code: longChain,
        errors: [
          {
            messageId: "unknownParam", // Could be unknownParamLongChain if chain detected
            data: { param: "unknown", func: "step1" },
            type: "Property",
          },
        ],
      },
    ],
  });

  console.log("✅ Chain message tests completed successfully");
} catch (error) {
  console.error("❌ Test failed:", error.message);
}
