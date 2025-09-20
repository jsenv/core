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

// Test import aliases - using 'as' syntax

ruleTester.run("no-unknown-params with import aliases", noUnknownParamsRule, {
  valid: [
    {
      // Valid usage with aliases
      code: `
        import { createResource as createAPI, updateResource as updateAPI } from './api-utils.js';
        
        createAPI({ type: "user", data: { name: "John" } });
        updateAPI({ id: 1, changes: { name: "Jane" } });
      `,
      filename: mainFilePath,
    },
  ],
  invalid: [
    {
      // Invalid parameters with aliases
      code: `
        import { createResource as createAPI, updateResource as updateAPI, deleteResource as deleteAPI } from './api-utils.js';
        
        createAPI({ type: "user", data: { name: "John" }, metadata: {} });
        updateAPI({ id: 1, changes: { name: "Jane" }, force: true });
        deleteAPI({ id: 1, cascade: true });
      `,
      output: `
        import { createResource as createAPI, updateResource as updateAPI, deleteResource as deleteAPI } from './api-utils.js';
        
        createAPI({ type: "user", data: { name: "John" } });
        updateAPI({ id: 1, changes: { name: "Jane" } });
        deleteAPI({ id: 1 });
      `,
      filename: mainFilePath,
      errors: [
        {
          message: `"metadata" not found in createAPI() (defined in ./api-utils.js)`,
          type: "Property",
        },
        {
          message: `"force" not found in updateAPI() (defined in ./api-utils.js)`,
          type: "Property",
        },
        {
          message: `"cascade" not found in deleteAPI() (defined in ./api-utils.js)`,
          type: "Property",
        },
      ],
    },
  ],
});

console.log("✅ Import aliases tests passed!");
