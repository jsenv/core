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

ruleTester.run("no-unknown-params - function chaining", rule, {
  valid: [
    {
      name: "parameter used through chaining with spread operator",
      code: validCode,
    },
  ],
  invalid: [
    {
      name: "parameter not used in chaining",
      code: invalidCode,
      errors: [
        {
          messageId: "unknownParam",
          data: { param: "c", func: "toto" },
          type: "Property",
        },
      ],
    },
  ],
});
