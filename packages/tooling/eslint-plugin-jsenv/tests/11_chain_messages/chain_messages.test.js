import { RuleTester } from "eslint";
import { readFileSync } from "fs";
import { join } from "path";
import rule from "../../lib/rules/no-unknown-params.js";

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

ruleTester.run("no-unknown-params - enhanced messages", rule, {
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
      errors: [
        {
          messageId: "unknownParam", // Falls back to basic message
          data: { param: "xyz", func: "greet" },
          type: "Property",
        },
      ],
    },
    {
      name: "parameter with potential typo",
      code: typoInvalidCode,
      errors: [
        {
          messageId: "unknownParamWithSuggestions", // Enhanced message with suggestions
          data: {
            param: "passwd",
            func: "authenticate",
            suggestions: "password",
          },
          type: "Property",
        },
      ],
    },
    {
      name: "extraneous parameter",
      code: extraneousInvalidCode,
      errors: [
        {
          messageId: "extraneousParam", // Enhanced message for extraneous params
          data: { param: "extra", func: "validate", expected: "email, phone" },
          type: "Property",
        },
      ],
    },
    {
      name: "unknown param in chain context",
      code: chainInvalidCode,
      errors: [
        {
          messageId: "unknownParam", // May get chain message with available params
          data: { param: "unknown", func: "step1" },
          type: "Property",
        },
      ],
    },
  ],
});
