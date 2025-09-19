import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesPath = join(__dirname, "fixtures");
const mainFilePath = join(fixturesPath, "main.js");

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

// Test edge cases and cross-file scenarios
ruleTester.run("no-unknown-params edge cases", noUnknownParamsRule, {
  valid: [
    {
      // Test chaining with imported functions
      code: `
        import { createChain } from './chain-utils.js';
        const result = createChain({ initial: "data" })
          .transform({ method: "uppercase" })
          .finalize();
      `,
      filename: mainFilePath,
      settings: {
        "import-x/resolver": {
          "@jsenv/eslint-import-resolver": {
            rootDirectoryUrl: fixturesPath,
            packageConditions: ["browser", "import"],
          },
        },
      },
    },
    {
      // Test with functions that return other functions
      code: `
        import { createValidator } from './validator-factory.js';
        const validator = createValidator({ strict: true });
        const result = validator({ data: "test" });
      `,
      filename: mainFilePath,
      settings: {
        "import-x/resolver": {
          "@jsenv/eslint-import-resolver": {
            rootDirectoryUrl: fixturesPath,
            packageConditions: ["browser", "import"],
          },
        },
      },
    },
  ],
  invalid: [
    {
      // Test chaining with invalid parameters
      code: `
        import { createChain } from './chain-utils.js';
        const result = createChain({ initial: "data", invalidParam: true });
      `,
      output: `
        import { createChain } from './chain-utils.js';
        const result = createChain({ initial: "data" });
      `,
      filename: mainFilePath,
      settings: {
        "import-x/resolver": {
          "@jsenv/eslint-import-resolver": {
            rootDirectoryUrl: fixturesPath,
            packageConditions: ["browser", "import"],
          },
        },
      },
      errors: [
        {
          messageId: "superfluous_param",
          data: {
            param: "invalidParam",
            func: "createChain",
            expected: "initial",
          },
        },
      ],
    },
    {
      // Test factory function with invalid parameters
      code: `
        import { createValidator } from './validator-factory.js';
        const validator = createValidator({ strict: true, unknownOption: false });
      `,
      output: `
        import { createValidator } from './validator-factory.js';
        const validator = createValidator({ strict: true });
      `,
      filename: mainFilePath,
      settings: {
        "import-x/resolver": {
          "@jsenv/eslint-import-resolver": {
            rootDirectoryUrl: fixturesPath,
            packageConditions: ["browser", "import"],
          },
        },
      },
      errors: [
        {
          messageId: "superfluous_param",
          data: {
            param: "unknownOption",
            func: "createValidator",
            expected: "strict",
          },
        },
      ],
    },
  ],
});

console.log("✅ Edge cases tests passed!");
