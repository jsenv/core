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

ruleTester.run(
  "no-unknown-params with complex destructuring",
  noUnknownParamsRule,
  {
    valid: [
      {
        // Define complex destructuring function inline
        code: `
        function processUser({ 
          name, 
          email, 
          profile: { age, preferences: { theme, notifications = {} } = {} } = {},
          settings: { privacy = "public", ...restSettings } = {}
        }) {
          return { name, email, age, theme, notifications, privacy, restSettings };
        }
        
        processUser({
          name: "John",
          email: "john@example.com",
          profile: {
            age: 30,
            preferences: {
              theme: "dark",
              notifications: { email: true, push: false }
            }
          },
          settings: {
            privacy: "private",
            otherSetting: "value"
          }
        });
      `,
        filename: mainFilePath,
      },
    ],
    invalid: [
      {
        code: `
        function processUser({ 
          name, 
          email, 
          profile: { age, preferences: { theme, notifications = {} } = {} } = {},
          settings: { privacy = "public", ...restSettings } = {}
        }) {
          return { name, email, age, theme, notifications, privacy, restSettings };
        }
        
        processUser({
          name: "John",
          email: "john@example.com",
          unknownTopLevel: "invalid",
          profile: {
            age: 30,
            preferences: {
              theme: "dark",
              notifications: { email: true }
            }
          }
        });
      `,
        output: `
        function processUser({ 
          name, 
          email, 
          profile: { age, preferences: { theme, notifications = {} } = {} } = {},
          settings: { privacy = "public", ...restSettings } = {}
        }) {
          return { name, email, age, theme, notifications, privacy, restSettings };
        }
        
        processUser({
          name: "John",
          email: "john@example.com",
          profile: {
            age: 30,
            preferences: {
              theme: "dark",
              notifications: { email: true }
            }
          }
        });
      `,
        filename: mainFilePath,
        errors: [
          {
            message: "unknownTopLevel does not exist in processUser()",
            type: "Property",
          },
        ],
      },
    ],
  },
);
