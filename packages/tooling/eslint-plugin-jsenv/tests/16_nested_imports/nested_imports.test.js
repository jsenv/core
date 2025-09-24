import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
  },
});

const fixturesDir = join(__dirname, "fixtures");
const mainFilePath = join(fixturesDir, "main.js");

// Test file that imports from a nested chain: core.js <- utils.js <- manager.js
ruleTester.run("no-unknown-params with nested imports", noUnknownParamsRule, {
  valid: [
    {
      // Nested imports work correctly
        options: [{ reportAllUnknownParams: true }],      code: `
        // Define the nested imports inline for testing
        function processItem({ item, config }) {
          return { processed: true, item, config };
        }
        
        function enhanceItem({ item, config, enhancement }) {
          return { enhanced: true, item, config, enhancement };
        }
        
        function handleItemWithDeepNesting({ item, config, enhancement, metadata }) {
          const processed = processItem({ item, config });
          const enhanced = enhanceItem({ item: processed.item, config, enhancement });
          return { ...enhanced, metadata, level: "deep" };
        }
        
        handleItemWithDeepNesting({
          item: "test",
          config: { setting: true },
          enhancement: "boost",
          metadata: { version: 1 }
        });
      `,
      filename: mainFilePath,
    },
  ],
  invalid: [
    {
        options: [{ reportAllUnknownParams: true }],      code: `
        // Define the nested imports inline for testing
        function processItem({ item, config }) {
          return { processed: true, item, config };
        }
        
        function enhanceItem({ item, config, enhancement }) {
          return { enhanced: true, item, config, enhancement };
        }
        
        function handleItemWithDeepNesting({ item, config, enhancement, metadata }) {
          const processed = processItem({ item, config });
          const enhanced = enhanceItem({ item: processed.item, config, enhancement });
          return { ...enhanced, metadata, level: "deep" };
        }
        
        handleItemWithDeepNesting({
          item: "test",
          config: { setting: true },
          enhancement: "boost",
          metadata: { version: 1 },
          unknownDeepParam: "invalid"
        });
      `,
      output: `
        // Define the nested imports inline for testing
        function processItem({ item, config }) {
          return { processed: true, item, config };
        }
        
        function enhanceItem({ item, config, enhancement }) {
          return { enhanced: true, item, config, enhancement };
        }
        
        function handleItemWithDeepNesting({ item, config, enhancement, metadata }) {
          const processed = processItem({ item, config });
          const enhanced = enhanceItem({ item: processed.item, config, enhancement });
          return { ...enhanced, metadata, level: "deep" };
        }
        
        handleItemWithDeepNesting({
          item: "test",
          config: { setting: true },
          enhancement: "boost",
          metadata: { version: 1 }
        });
      `,
      filename: mainFilePath,
      errors: [
        {
          message: `"unknownDeepParam" not found in handleItemWithDeepNesting()`,
          type: "Property",
        },
      ],
    },
  ],
});
