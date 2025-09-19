import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

// Test rest parameter tracking with imported functions (user's reported case)
ruleTester.run(
  "rest parameter tracking - imported functions",
  noUnknownParamsRule,
  {
    valid: [
      {
        name: "mixed destructuring with imported function should work",
        code: `
        import { build } from "@jsenv/core";

        const test = async ({ expectedFileCount, ...params }) => {
          console.log(expectedFileCount);
          await build({ ...params });
        };

        test({
          versioning: false, 
        });
      `,
      },
      {
        name: "only rest parameter with imported function should work",
        code: `
        import { build } from "@jsenv/core";

        const test = async ({ ...params }) => {
          await build({ ...params });
        };

        test({
          versioning: false
        });
      `,
      },
    ],
    invalid: [],
  },
);
