import { RuleTester } from "eslint";
import rule from "../../lib/rules/no-extra-params.js";
import { readFileSync } from "fs";
import { join } from "path";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

const fixturesDir = join(import.meta.dirname, "fixtures");

const validCode = readFileSync(join(fixturesDir, "input_valid.js"), "utf8");
const invalidCode = readFileSync(join(fixturesDir, "input_invalid.js"), "utf8");

ruleTester.run("no-extra-params - rest parameters", rule, {
  valid: [
    {
      name: "rest parameters accept extra properties",
      code: validCode,
    },
  ],
  invalid: [
    {
      name: "mixed rest and non-rest parameters - extra in non-rest",
      code: invalidCode,
      errors: [
        {
          messageId: "extraParam",
          data: { param: "extra", func: "mixed" },
          type: "Property",
        },
      ],
    },
  ],
});