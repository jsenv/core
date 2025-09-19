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

ruleTester.run("no-unknown-params - function basic", rule, {
  valid: [
    {
      name: "function uses all parameters",
      code: validCode,
    },
  ],
  invalid: [
    {
      name: "function with extra parameter",
      code: invalidCode,
      output: `function foo({ a }) {
  console.log(a);
}
foo({ a: 1 });
`,
      errors: [
        {
          messageId: "unknownParam",
          data: { param: "b", func: "foo" },
          type: "Property",
        },
      ],
    },
  ],
});
