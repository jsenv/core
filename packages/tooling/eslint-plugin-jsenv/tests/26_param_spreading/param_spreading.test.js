import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

// Test parameter spreading through rest parameters
ruleTester.run("no-unknown-params parameter spreading", noUnknownParamsRule, {
  valid: [
    {
      name: "bundling parameter should not be flagged when spread to defined function",
      code: `
const test = async ({ expectedFileCount, ...params }) => {
  const { buildFileContents } = await build({
    logLevel: "warn",
    ...params, // Should spread bundling to build()
  });
  return buildFileContents;
};

const build = ({ logLevel, bundling, minification, versioning }) => {
  return { buildFileContents: {} };
};

await test({
  expectedFileCount: 2,
  bundling: {
    js_module: {
      rollupOutput: {
        experimentalMinChunkSize: 1000,
      },
    },
  },
  minification: false,
  versioning: false,
});
      `,
    },
    {
      name: "bundling parameter should not be flagged when spread to external function",
      code: `
const test = async ({ expectedFileCount, ...params }) => {
  const { buildFileContents } = await externalBuild({
    logLevel: "warn",
    ...params, // Should spread bundling to external function
  });
  return buildFileContents;
};

// External function - not defined in this file, imported from elsewhere
// Should NOT report 'bundling does not exist in test()' even though 
// externalBuild is not defined here
await test({
  expectedFileCount: 2,
  bundling: {
    js_module: {
      rollupOutput: {
        experimentalMinChunkSize: 1000,
      },
    },
  },
  minification: false,
  versioning: false,
});
      `,
    },
  ],
  invalid: [],
});
