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

const validCode = readFileSync(join(fixturesDir, "jsx_valid.jsx"), "utf8");
const invalidCode = readFileSync(join(fixturesDir, "jsx_invalid.jsx"), "utf8");

ruleTester.run("no-unknown-params - JSX components", rule, {
  valid: [
    {
      name: "JSX components with matching props",
      code: validCode,
    },
  ],
  invalid: [
    {
      name: "JSX components with extra props",
      code: invalidCode,
      errors: [
        {
          messageId: "unknownParam",
          data: { param: "b", func: "Toto" },
          type: "JSXAttribute",
        },
        {
          messageId: "unknownParam",
          data: { param: "disabled", func: "Button" },
          type: "JSXAttribute",
        },
        {
          messageId: "unknownParam",
          data: { param: "size", func: "Button" },
          type: "JSXAttribute",
        },
      ],
    },
  ],
});
