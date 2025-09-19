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

const validCode = readFileSync(join(fixturesDir, "chaining_valid.js"), "utf8");
const invalidCode = readFileSync(
  join(fixturesDir, "chaining_invalid.js"),
  "utf8",
);

ruleTester.run("no-unknown-params - chaining order independence", rule, {
  valid: [
    {
      name: "function chaining before definition - valid usage",
      code: validCode,
    },
  ],
  invalid: [
    {
      name: "function chaining before definition - with unused param",
      code: invalidCode,
      errors: [
        {
          messageId: "unknownParam",
          data: { param: "unused", func: "processData" },
        },
      ],
    },
  ],
});

console.log("✅ Chaining order independence tests passed!");
