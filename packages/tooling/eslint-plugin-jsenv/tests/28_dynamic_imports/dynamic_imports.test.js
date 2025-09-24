import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

// Test dynamic import scenario similar to js_module_small_helper.xtest.mjs
ruleTester.run("no-unknown-params dynamic imports", noUnknownParamsRule, {
  valid: [
    {
      name: "parameters passed through dynamic import wrapper (external functions accept any params)",
      options: [{ reportAllUnknownParams: true }],      code: `
        import { build } from "./build_wrapper.js";

        const test = async ({ expectedCount, ...params }) => {
          const result = await build({
            logLevel: "warn",
            ...params,
          });
          return result;
        };

        // External functions accept any parameters - no error expected
        await test({
          expectedCount: 2,
          bundling: true,
          minification: false,
          unknownParam: "accepted", // This is accepted for external functions
        });
      `,
    },
    {
      name: "local function definition - parameters are validated",
      options: [{ reportAllUnknownParams: true }],      code: `
        // Local build function that only accepts specific parameters
        const build = ({ logLevel, bundling, minification }) => {
          return { logLevel, bundling, minification };
        };

        const test = async ({ expectedCount, ...params }) => {
          const result = build({
            logLevel: "warn",
            ...params,
          });
          return result;
        };

        // Valid parameters for local function
        test({
          expectedCount: 2,
          bundling: true,
          minification: false,
        });
      `,
    },
  ],
  invalid: [
    {
      name: "invalid parameter with local function definition",
      options: [{ reportAllUnknownParams: true }],      code: `
        // Local build function that only accepts specific parameters
        const build = ({ logLevel, bundling, minification }) => {
          return { logLevel, bundling, minification };
        };

        const test = async ({ expectedCount, ...params }) => {
          const result = build({
            logLevel: "warn",
            ...params,
          });
          return result;
        };

        // Invalid parameter for local function should be flagged
        test({
          expectedCount: 2,
          unknownParam: "invalid", // This should be flagged
        });
      `,
      output: `
        // Local build function that only accepts specific parameters
        const build = ({ logLevel, bundling, minification }) => {
          return { logLevel, bundling, minification };
        };

        const test = async ({ expectedCount, ...params }) => {
          const result = build({
            logLevel: "warn",
            ...params,
          });
          return result;
        };

        // Invalid parameter for local function should be flagged
        test({
          expectedCount: 2, // This should be flagged
        });
      `,
      errors: [
        {
          messageId: "not_found_param_chain_with_suggestions",
          data: {
            param: "unknownParam",
            firstFunc: "test",
            secondFunc: "build",
            available: "expectedCount, logLevel, bundling, minification",
          },
        },
      ],
    },
  ],
});
