import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

// Test rest parameter tracking with dynamic imports vs static imports
ruleTester.run(
  "rest parameter tracking - dynamic imports",
  noUnknownParamsRule,
  {
    valid: [
      {
        name: "static import should work",
        code: `
        import { build } from "./fixtures/build.js";

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
        name: "dynamic import should also work",
        code: `
        const test = async ({ expectedFileCount, ...params }) => {
          const { build } = await import("./fixtures/build.js");
          console.log(expectedFileCount);
          await build({ ...params });
        };

        test({
          versioning: false, 
        });
      `,
      },
      {
        name: "local function with dynamic import wrapper",
        code: `
        // Local function that dynamically imports and forwards parameters
        const buildWrapper = async (options) => {
          const { build } = await import("./fixtures/build.js");
          return build(options);
        };

        const test = async ({ expectedFileCount, ...params }) => {
          console.log(expectedFileCount);
          await buildWrapper({ ...params });
        };

        test({
          versioning: false, 
        });
      `,
      },
    ],
    invalid: [
      {
        name: "local function should still validate parameters",
        code: `
        // Local function that only accepts specific params
        const build = ({ logLevel }) => ({ logLevel });

        const test = async ({ expectedFileCount, ...params }) => {
          console.log(expectedFileCount);
          await build({ ...params }); // params spread to local function
        };

        test({
          expectedFileCount: 2,
          versioning: false, // Should error - local build doesn't accept versioning
        });
      `,
        output: `
        // Local function that only accepts specific params
        const build = ({ logLevel }) => ({ logLevel });

        const test = async ({ expectedFileCount, ...params }) => {
          console.log(expectedFileCount);
          await build({ ...params }); // params spread to local function
        };

        test({
          expectedFileCount: 2, // Should error - local build doesn't accept versioning
        });
      `,
        errors: [
          {
            messageId: "not_found_param",
            data: { param: "versioning", func: "test" },
            type: "Property",
          },
        ],
      },
    ],
  },
);
