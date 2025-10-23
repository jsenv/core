import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-unknown-params - external imports", noUnknownParamsRule, {
  valid: [
    {
      name: "External package imports should accept rest parameters",
      options: [{ reportAllUnknownParams: true }],
      code: `import { build } from "@jsenv/core";

const test = async ({ expectedFileCount, ...params }) => {
  console.log(expectedFileCount);
  await build({ ...params });
};

await test({
  minification: false,
});`,
    },
    {
      name: "External namespace imports should work",
      options: [{ reportAllUnknownParams: true }],
      code: `import * as core from "@jsenv/core";

const test = async ({ expectedFileCount, ...params }) => {
  console.log(expectedFileCount);
  await core.build({ ...params });
};

await test({
  minification: false,
});`,
    },
    {
      name: "Multiple external imports should work",
      options: [{ reportAllUnknownParams: true }],
      code: `import { build, serve } from "@jsenv/core";

const test = async ({ expectedFileCount, ...buildParams }) => {
  console.log(expectedFileCount);
  await build({ ...buildParams });
};

const test2 = async ({ port, ...serveParams }) => {
  console.log(port);
  await serve({ ...serveParams });
};

await test({ minification: false });
await test2({ cors: true });`,
    },
  ],
  invalid: [
    // Note: External functions are treated as accepting any parameters
    // since we don't have their source code to validate against
  ],
});
