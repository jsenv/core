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

const validCode = readFileSync(join(fixturesDir, "input_valid.js"), "utf8");
const invalidCode = readFileSync(join(fixturesDir, "input_invalid.js"), "utf8");

ruleTester.run("no-unknown-params - order independence", rule, {
  valid: [
    {
      name: "function call before definition - valid usage",
      code: validCode,
    },
  ],
  invalid: [
    {
      name: "function call before definition - with extra param",
      code: invalidCode,
      errors: [
        {
          messageId: "unknownParam",
          data: { param: "extra", func: "doSomething" },
        },
      ],
    },
  ],
});

console.log("✅ Order independence tests passed!");
