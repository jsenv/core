import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

// Test scope resolution - local declarations should shadow imports
ruleTester.run("no-unknown-params scope resolution", noUnknownParamsRule, {
  valid: [
    {
      name: "local function declaration shadows imported function",
      code: `
        import { validate } from './external.js';

        {
          // Local function that accepts any parameter
          const validate = (data) => {
            console.log(data);
          };
          
          // Should use local validate, not imported one
          validate({ customParam: true });
        }
      `,
    },
    {
      name: "local arrow function shadows imported function",
      code: `
        import { process } from './utils.js';

        {
          const process = ({ input, custom }) => {
            return { input, custom };
          };
          
          process({ input: "test", custom: "value" });
        }
      `,
    },
    {
      name: "local function declaration in nested block",
      code: `
        import { handler } from './handlers.js';

        function main() {
          {
            function handler(config) {
              return config.value;
            }
            
            // Should use local handler
            handler({ value: 42, extraParam: "allowed" });
          }
        }
      `,
    },
    {
      name: "local function shadows import with rest parameters",
      code: `
        import { build } from './external.js';

        {
          const build = ({ type, ...options }) => {
            console.log(type, options);
          };
          
          build({ 
            type: "production",
            bundling: true, 
            minification: false 
          });
        }
      `,
    },
  ],
  invalid: [],
});
