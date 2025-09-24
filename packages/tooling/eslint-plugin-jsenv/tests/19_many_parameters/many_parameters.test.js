import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
  },
});

ruleTester.run("no-unknown-params with many parameters", noUnknownParamsRule, {
  valid: [
    {
      code: `
        function processComplexData({ 
          id, name, email, age, address, phone, 
          preferences, settings, metadata, timestamp 
        }) {
          return { id, name, email, age, address, phone, preferences, settings, metadata, timestamp };
        }
        
        processComplexData({
          id: 1,
          name: "John",
          email: "john@example.com", 
          age: 30,
          address: "123 Main St",
          phone: "555-1234",
          preferences: { theme: "dark" },
          settings: { notifications: true },
          metadata: { created: "2024-01-01" },
          timestamp: Date.now()
        });
      `,
      filename: "/test.js",
    },
  ],
  invalid: [
    {
      // This should show the shortened parameter list
      options: [{ reportAllUnknownParams: true }],
      code: `
        function processComplexData({ 
          id, name, email, age, address, phone, 
          preferences, settings, metadata, timestamp 
        }) {
          return { id, name, email, age, address, phone, preferences, settings, metadata, timestamp };
        }
        
        processComplexData({
          id: 1,
          name: "John",
          email: "john@example.com", 
          age: 30,
          address: "123 Main St",
          phone: "555-1234",
          preferences: { theme: "dark" },
          settings: { notifications: true },
          metadata: { created: "2024-01-01" },
          timestamp: Date.now(),
          unknownParam: "should be flagged"
        });
      `,
      output: `
        function processComplexData({ 
          id, name, email, age, address, phone, 
          preferences, settings, metadata, timestamp 
        }) {
          return { id, name, email, age, address, phone, preferences, settings, metadata, timestamp };
        }
        
        processComplexData({
          id: 1,
          name: "John",
          email: "john@example.com", 
          age: 30,
          address: "123 Main St",
          phone: "555-1234",
          preferences: { theme: "dark" },
          settings: { notifications: true },
          metadata: { created: "2024-01-01" },
          timestamp: Date.now()
        });
      `,
      filename: "/test.js",
      errors: [
        {
          message: `"unknownParam" not found in processComplexData()`,
          type: "Property",
        },
      ],
    },
  ],
});
