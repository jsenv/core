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

// Test different import patterns and resolver configurations
ruleTester.run("no-unknown-params advanced scenarios", noUnknownParamsRule, {
  valid: [
    {
      // Test with renamed imports
      code: `
        import { processData as process } from './utils/data-processor.js';
        process({ input: "data", format: "json" });
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
      // Test with default import (should be ignored for now since we only handle named exports)
      code: `
        import defaultHandler from './utils/default-handler.js';
        import { namedFunction } from './utils/default-handler.js';
        defaultHandler({ anything: true }); // Should not error (default import not analyzed)
        namedFunction({ id: 1, name: "test" }); // Should work
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
      // Test renamed imports with error detection
      code: `
        import { processData as process } from './utils/data-processor.js';
        process({ input: "data", format: "json", invalid: true });
      `,
      output: `
        import { processData as process } from './utils/data-processor.js';
        process({ input: "data", format: "json" });
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
            param: "invalid",
            func: "process",
            expected: "input, format",
          },
        },
      ],
    },
    {
      // Test named function with error, while default import is ignored
      code: `
        import defaultHandler from './utils/default-handler.js';
        import { namedFunction } from './utils/default-handler.js';
        namedFunction({ id: 1, name: "test", extra: "field" });
      `,
      output: `
        import defaultHandler from './utils/default-handler.js';
        import { namedFunction } from './utils/default-handler.js';
        namedFunction({ id: 1, name: "test" });
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
          data: { param: "extra", func: "namedFunction", expected: "id, name" },
        },
      ],
    },
  ],
});

console.log("✅ Advanced scenarios tests passed!");
