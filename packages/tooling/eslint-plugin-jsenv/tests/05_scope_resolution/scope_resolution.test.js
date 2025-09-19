import { RuleTester } from "eslint";
import rule from "../../lib/rules/no-unknown-params.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-unknown-params - scope resolution", rule, {
  valid: [
    {
      name: "function name reused in different scope (dynamic import)",
      code: `export const createSecureServer = async ({ certificate, privateKey }) => {
  const { createSecureServer } = await import("https");
  return createSecureServer({
    cert: certificate,
    key: privateKey,
  });
};`,
    },
  ],
  invalid: [
    {
      name: "simple case with extra parameter",
      code: `const simpleFunction = ({ used }) => {
  return used;
};

simpleFunction({ used: "test", extraParam: "should error" });`,
      output: `const simpleFunction = ({ used }) => {
  return used;
};

simpleFunction({ used: "test" });`,
      errors: [
        {
          messageId: "not_found_param",
          data: { param: "extraParam", func: "simpleFunction" },
          type: "Property",
        },
      ],
    },
  ],
});
