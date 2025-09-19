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

const validCode = readFileSync(join(fixturesDir, "input_valid.js"), "utf8");
const invalidCode = readFileSync(join(fixturesDir, "input_invalid.js"), "utf8");

ruleTester.run("no-unknown-params - unknown functions", rule, {
  valid: [
    {
      name: "unknown functions should be ignored - no errors expected",
      code: validCode,
    },
  ],
  invalid: [
    {
      name: "known functions analyzed, unknown functions ignored",
      code: invalidCode,
      errors: [
        {
          messageId: "unknownParam",
          data: { param: "extra", func: "knownFunction" },
        },
      ],
    },
  ],
});

console.log("✅ Unknown functions tests passed!");
