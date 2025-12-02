import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";
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

ruleTester.run("no-unknown-params - multiple parameters", noUnknownParamsRule, {
  valid: [
    {
      name: "multiple parameters with valid object destructuring",
      options: [{ reportAllUnknownParams: true }],
      code: validCode,
    },
  ],
  invalid: [
    {
      name: "multiple parameters with extra property in object",
      options: [{ reportAllUnknownParams: true }],
      code: invalidCode,
      output: `const toto = (a, { b, c }) => {
  console.log(a, b, c);
};
toto("hello", { b: 1, c: 2 });
`,
      errors: [
        {
          messageId: "not_found_param",
          data: { param: "d", func: `"toto" params` },
          type: "Property",
        },
      ],
    },
  ],
});
