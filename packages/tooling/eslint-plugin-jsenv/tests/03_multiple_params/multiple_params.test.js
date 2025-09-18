import { RuleTester } from "eslint";
import { readFileSync } from "fs";
import { join } from "path";
import rule from "../../lib/rules/no-extra-params.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

const fixturesDir = join(import.meta.dirname, "fixtures");

const validCode = readFileSync(join(fixturesDir, "input_valid.js"), "utf8");
const invalidCode = readFileSync(join(fixturesDir, "input_invalid.js"), "utf8");

ruleTester.run("no-extra-params - multiple parameters", rule, {
  valid: [
    {
      name: "multiple parameters with valid object destructuring",
      code: validCode,
    },
  ],
  invalid: [
    {
      name: "multiple parameters with extra property in object",
      code: invalidCode,
      errors: [
        {
          messageId: "extraParam",
          data: { param: "d", func: "toto" },
          type: "Property",
        },
      ],
    },
  ],
});
