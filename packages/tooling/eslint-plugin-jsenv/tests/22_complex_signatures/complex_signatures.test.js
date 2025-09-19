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

// Test with complex function signatures and mixed parameter types
ruleTester.run(
  "no-unknown-params complex function signatures",
  noUnknownParamsRule,
  {
    valid: [
      {
        // Test with optional parameters and computed properties
        code: `
        import { complexFunction } from './complex-signatures.js';
        complexFunction({ 
          required: "value", 
          config: { nested: true },
          list: [1, 2, 3]
        });
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
        // Test with extra nested properties (should detect top-level unknown props)
        code: `
        import { complexFunction } from './complex-signatures.js';
        complexFunction({ 
          required: "value", 
          config: { nested: true },
          list: [1, 2, 3],
          unknownProp: "should error"
        });
      `,
        output: `
        import { complexFunction } from './complex-signatures.js';
        complexFunction({ 
          required: "value", 
          config: { nested: true },
          list: [1, 2, 3]
        });
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
              param: "unknownProp",
              func: "complexFunction",
              expected: "required, config, list",
            },
          },
        ],
      },
    ],
  },
);

console.log("✅ Complex function signatures tests passed!");
