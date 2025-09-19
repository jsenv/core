import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
  },
});

ruleTester.run("no-unknown-params with import errors", noUnknownParamsRule, {
  valid: [
    {
      // When import resolution fails (missing file or syntax error),
      // the rule should gracefully handle it and not crash
      code: `
        import { brokenFunction } from "./fixtures/broken.js";
        
        // Since we can't resolve the function signature, 
        // we should allow any parameters (fail safe)
        brokenFunction({
          anyParam: "should be allowed when import fails",
          anotherParam: true
        });
      `,
      filename: "/test.js",
    },
    {
      // Test with missing import file
      code: `
        import { missingFunction } from "./fixtures/nonexistent.js";
        
        missingFunction({
          anyParam: "should be allowed when file missing",
        });
      `,
      filename: "/test.js",
    },
  ],
  invalid: [
    // No invalid tests here since we can't validate parameters
    // when import resolution fails - the rule should be permissive
  ],
});
