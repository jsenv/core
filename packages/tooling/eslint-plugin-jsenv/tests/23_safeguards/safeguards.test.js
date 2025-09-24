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

// Test safeguards - depth limits should prevent excessive memory usage
ruleTester.run("no-unknown-params safeguards", noUnknownParamsRule, {
  valid: [
    {
      // Test with custom low chain depth limit
      code: `
        // Create a long function chain that would exceed the limit
        function f1({ p1, ...rest }) { return f2({ ...rest }); }
        function f2({ p2, ...rest }) { return f3({ ...rest }); }
        function f3({ p3, ...rest }) { return f4({ ...rest }); }
        function f4({ p4, ...rest }) { return f5({ ...rest }); }
        function f5({ p5, ...rest }) { return f6({ ...rest }); }
        function f6({ p6 }) { return { p6 }; }
        
        // This should work with normal limits but fail with low limit
        f1({ p1: 1, p6: 6 });
      `,
      filename: mainFilePath,
      options: [{ maxChainDepth: 10 }], // Allow reasonable depth
    },
    {
      // Test import depth configuration
      code: `
        import { deepFunction } from './deep-imports.js';
        
        // Test with reasonable import depth
        deepFunction({ validParam: true });
      `,
      filename: mainFilePath,
      options: [{ maxImportDepth: 5 }],
    },
  ],
  invalid: [
    {
      // Test with very low chain depth limit - should give up checking and not find p6
      // Both p6 and unknownParam will be flagged because depth limit prevents deep chain analysis
      code: `
        function f1({ p1, ...rest }) { return f2({ ...rest }); }
        function f2({ p2, ...rest }) { return f3({ ...rest }); }
        function f3({ p3, ...rest }) { return f4({ ...rest }); }
        function f4({ p4, ...rest }) { return f5({ ...rest }); }
        function f5({ p5, ...rest }) { return f6({ ...rest }); }
        function f6({ p6 }) { return { p6 }; }
        
        f1({ p1: 1, p6: 6, unknownParam: "test" });
      `,
      output: `
        function f1({ p1, ...rest }) { return f2({ ...rest }); }
        function f2({ p2, ...rest }) { return f3({ ...rest }); }
        function f3({ p3, ...rest }) { return f4({ ...rest }); }
        function f4({ p4, ...rest }) { return f5({ ...rest }); }
        function f5({ p5, ...rest }) { return f6({ ...rest }); }
        function f6({ p6 }) { return { p6 }; }
        
        f1({ p1: 1, unknownParam: "test" });
      `,
      filename: mainFilePath,
      options: [{ maxChainDepth: 2, reportAllUnknownParams: true }], // Very low limit - should stop early
      errors: [
        {
          messageId: "not_found_param_chain_with_suggestions",
          data: {
            param: "p6",
            firstFunc: "f1",
            secondFunc: "f2",
            available: "p1, p2",
          },
          type: "Property",
        },
        {
          messageId: "not_found_param_chain_with_suggestions",
          data: {
            param: "unknownParam",
            firstFunc: "f1",
            secondFunc: "f2",
            available: "p1, p2",
          },
          type: "Property",
        },
      ],
    },
  ],
});

console.log("✅ Safeguards tests passed!");
