import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run(
  "no-unknown-params rest destructuring fix",
  noUnknownParamsRule,
  {
    valid: [
      {
        name: "regular params should work",
      options: [{ reportAllUnknownParams: true }],        code: `
        import { build } from "@jsenv/core";

        const test = async (params) => {
          await build(params);
        };

        await test({
          versioning: false,
        });
      `,
      },
      {
        name: "rest destructuring should work like regular params",
      options: [{ reportAllUnknownParams: true }],        code: `
        import { build } from "@jsenv/core";

        const test = async ({ ...params }) => {
          await build(params);
        };

        await test({
          versioning: false,
        });
      `,
      },
    ],
    invalid: [],
  },
);
