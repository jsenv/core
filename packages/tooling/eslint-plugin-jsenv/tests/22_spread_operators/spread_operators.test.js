import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

const fixturesDir = join(__dirname, "fixtures");
const mainFilePath = join(fixturesDir, "main.js");

// Test spread operator parameter passing
ruleTester.run("no-unknown-params spread operators", noUnknownParamsRule, {
  valid: [
    {
      // Valid usage with imports - spread operator should pass parameters through
      code: `
        import { createAction } from './actions.js';
        
        // Wrapper function that passes options through via spread
        function createWrapper({ callback, ...options }) {
          return createAction(callback, {
            name: "wrapper",
      options: [{ reportAllUnknownParams: true }],            ...options, // Should pass any options through to createAction
          });
        }
        
        // This should be valid - compute and meta are valid for createAction
        createWrapper({
          callback: () => {},
          compute: (id) => id,
          meta: { test: true },
        });
      `,
      filename: mainFilePath,
    },
    {
      // Valid usage with inline functions - simple object parameter with default
      code: `
        // Simple object parameter function with default (like createAction)
        function createAction(callback, rootOptions = {}) {
          return { callback, ...rootOptions };
        }
        
        // Wrapper that spreads to createAction
        function createWrapper({ callback, ...options }) {
          return createAction(callback, { ...options });
        }
        
        // This should be valid - any option can be passed through
        createWrapper({
          callback: () => {},
          compute: (id) => id,
          anyProperty: "should work",
        });
      `,
      filename: mainFilePath,
    },
  ],
  invalid: [
    // No invalid cases for this test since createAction accepts any parameters via ...otherOptions or rootOptions = {}
  ],
});

console.log("✅ Spread operator tests passed!");
