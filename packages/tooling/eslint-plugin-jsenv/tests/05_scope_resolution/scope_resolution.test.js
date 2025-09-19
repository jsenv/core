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

ruleTester.run("no-unknown-params - scope resolution", rule, {
  valid: [
    {
      name: "function name reused in different scope (dynamic import)",
      code: validCode,
    },
  ],
  invalid: [
    {
      name: "simple case with extra parameter",
      code: invalidCode,
      errors: [
        {
          messageId: "unknownParam",
          data: { param: "extraParam", func: "simpleFunction" },
          type: "Property",
        },
      ],
    },
  ],
});
