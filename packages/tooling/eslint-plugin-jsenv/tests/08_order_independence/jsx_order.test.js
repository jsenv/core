import { RuleTester } from "eslint";
import { readFileSync } from "fs";
import { join } from "path";
import rule from "../../lib/rules/no-extra-params.js";

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

const validCode = readFileSync(join(fixturesDir, "jsx_valid.jsx"), "utf8");
const invalidCode = readFileSync(join(fixturesDir, "jsx_invalid.jsx"), "utf8");

ruleTester.run("no-extra-params - JSX order independence", rule, {
  valid: [
    {
      name: "JSX usage before component definition - valid",
      code: validCode,
    },
  ],
  invalid: [
    {
      name: "JSX usage before component definition - with extra prop",
      code: invalidCode,
      errors: [
        {
          messageId: "extraParam",
          data: { param: "extra", func: "MyComponent" },
        },
      ],
    },
  ],
});

console.log("✅ JSX order independence tests passed!");
