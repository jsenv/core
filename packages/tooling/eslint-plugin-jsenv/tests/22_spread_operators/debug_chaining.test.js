// Debug test - check what checkParameterChaining returns
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
const mainFilePath = join(fixturesDir, "debug.js");

// Simple debug test
ruleTester.run("debug spread operators", noUnknownParamsRule, {
  valid: [
    {
      // Now this should be valid with the fix
      code: `
        // Simple object parameter function (like createAction)
        function createAction(callback, rootOptions = {}) {
          return { callback, ...rootOptions };
        }
        
        // Wrapper that spreads to createAction
        function createWrapper({ callback, ...options }) {
          return createAction(callback, { ...options });
        }
        
        // This should be valid after the fix
        createWrapper({
          callback: () => {},
          compute: (id) => id, // Should be OK via ...options -> createAction
        });
      `,
      filename: mainFilePath,
    },
  ],
  invalid: [], // No invalid cases for this debug test
});

console.log("✅ Debug spread operator test completed!");
