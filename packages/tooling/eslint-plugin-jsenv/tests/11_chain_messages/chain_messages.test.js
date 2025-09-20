import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";
import { readFileSync } from "fs";
import { join } from "path";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

const fixturesDir = join(import.meta.dirname, "fixtures");

const validCode = readFileSync(join(fixturesDir, "valid.js"), "utf8");
const simpleInvalidCode = readFileSync(
  join(fixturesDir, "simple_invalid.js"),
  "utf8",
);
const typoInvalidCode = readFileSync(
  join(fixturesDir, "typo_invalid.js"),
  "utf8",
);
const extraneousInvalidCode = readFileSync(
  join(fixturesDir, "extraneous_invalid.js"),
  "utf8",
);
const chainInvalidCode = readFileSync(
  join(fixturesDir, "chain_invalid.js"),
  "utf8",
);

ruleTester.run("no-unknown-params - enhanced messages", noUnknownParamsRule, {
  valid: [
    {
      name: "all parameters recognized in chain",
      code: validCode,
    },
  ],
  invalid: [
    {
      name: "simple unknown parameter",
      code: simpleInvalidCode,
      output: `// Test case: Simple direct function call with completely unknown parameter
function greet({ name }) {
  return \`Hello \${name}\`;
}
greet({  }); // 'xyz' is completely unknown and different from expected params
`,
      errors: [
        {
          messageId: "not_found_param", // Falls back to basic message
          data: { param: "xyz", func: "greet" },
          type: "Property",
        },
      ],
    },
    {
      name: "parameter with potential typo",
      code: typoInvalidCode,
      output: `// Test case: Function call with typo in parameter name
function authenticate({ username, password }) {
  return login(username, password);
}
authenticate({ username: "john" }); // 'passwd' should suggest 'password'
`,
      errors: [
        {
          messageId: "not_found_param_with_suggestions", // Enhanced message with suggestions
          data: {
            param: "passwd",
            func: "authenticate",
            suggestions: "password",
          },
          type: "Property",
          suggestions: [
            {
              desc: "Remove 'passwd'",
              output: `// Test case: Function call with typo in parameter name
function authenticate({ username, password }) {
  return login(username, password);
}
authenticate({ username: "john" }); // 'passwd' should suggest 'password'
`,
            },
            {
              desc: "Rename 'passwd' to 'password'",
              output: `// Test case: Function call with typo in parameter name
function authenticate({ username, password }) {
  return login(username, password);
}
authenticate({ username: "john", password: "secret" }); // 'passwd' should suggest 'password'
`,
            },
          ],
        },
      ],
    },
    {
      name: "extraneous parameter",
      code: extraneousInvalidCode,
      output: `// Test case: Extraneous parameter (user provided all expected params + one extra)
function validate({ email, phone }) {
  console.log(email, phone);
}
validate({ email: "test@example.com", phone: "123" }); // 'extra' should trigger extraneous message
`,
      errors: [
        {
          messageId: "not_found_param", // Enhanced message for extraneous params
          data: { param: "extra", func: "validate" },
          type: "Property",
        },
      ],
    },
    {
      name: "unknown param in chain context",
      code: chainInvalidCode,
      output: `// Test case: Chain with available parameters shown
function step1({ id, ...rest }) {
  return step2({ ...rest });
}
function step2({ name, email, config }) {
  console.log(name, email, config);
}
step1({ id: 1, name: "John", email: "john@test.com" }); // Should show available params
`,
      errors: [
        {
          messageId: "not_found_param_chain_with_suggestions", // Chain message with available params
          data: {
            param: "unknown",
            firstFunc: "step1",
            secondFunc: "step2",
            available: "id, name, email, config",
          },
          type: "Property",
        },
      ],
    },
  ],
});
