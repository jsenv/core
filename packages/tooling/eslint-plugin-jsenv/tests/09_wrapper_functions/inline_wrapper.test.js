import { RuleTester } from "eslint";
import { readFileSync } from "fs";
import { join } from "path";
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

const fixturesDir = join(import.meta.dirname, "fixtures");

const inlineValid = readFileSync(join(fixturesDir, "inline_valid.js"), "utf8");
const inlineInvalid = readFileSync(
  join(fixturesDir, "inline_invalid.js"),
  "utf8",
);

ruleTester.run("no-unknown-params - inline wrapper functions", rule, {
  valid: [
    {
      name: "inline function expressions in wrappers with valid props",
      code: inlineValid,
    },
  ],
  invalid: [
    {
      name: "inline function expressions in wrappers with extra props",
      code: inlineInvalid,
      errors: [
        {
          messageId: "unknownParam",
          data: { param: "extra1", func: "ForwardRefInline" },
        },
        {
          messageId: "unknownParam",
          data: { param: "extra2", func: "MemoInline" },
        },
      ],
    },
  ],
});

console.log("✅ Inline wrapper functions tests passed!");
