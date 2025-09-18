import { RuleTester } from "eslint";
import { readFileSync } from "fs";
import { join } from "path";
import rule from "../../lib/rules/no-extra-params.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

const fixturesDir = join(import.meta.dirname, "fixtures");

const validCode = readFileSync(join(fixturesDir, "input_valid.js"), "utf8");
const invalidCode = readFileSync(join(fixturesDir, "input_invalid.js"), "utf8");
const propagationValidCode = readFileSync(
  join(fixturesDir, "propagation_valid.js"),
  "utf8",
);
const propagationInvalidCode = readFileSync(
  join(fixturesDir, "propagation_invalid.js"),
  "utf8",
);
const nonPropagatedValidCode = readFileSync(
  join(fixturesDir, "non_propagated_valid.js"),
  "utf8",
);

ruleTester.run("no-extra-params - rest parameters", rule, {
  valid: [
    {
      name: "basic rest parameters accept extra properties",
      code: validCode,
    },
    {
      name: "rest params propagated to functions that use the properties",
      code: propagationValidCode,
    },
    {
      name: "rest params not propagated (no-unused-vars handles unused rest)",
      code: nonPropagatedValidCode,
    },
  ],
  invalid: [
    {
      name: "mixed rest and non-rest parameters - extra in non-rest",
      code: invalidCode,
      errors: [
        {
          messageId: "extraParam",
          data: { param: "extra", func: "mixed" },
          type: "Property",
        },
      ],
    },
    {
      name: "rest params propagated but properties unused in chain",
      code: propagationInvalidCode,
      errors: [
        {
          messageId: "extraParam",
          data: { param: "debug", func: "initializeApp" },
          type: "Property",
        },
        {
          messageId: "extraParam",
          data: { param: "timeout", func: "initializeApp" },
          type: "Property",
        },
        {
          messageId: "extraParam",
          data: { param: "email", func: "createUser" },
          type: "Property",
        },
        {
          messageId: "extraParam",
          data: { param: "age", func: "createUser" },
          type: "Property",
        },
        {
          messageId: "extraParam",
          data: { param: "headers", func: "processRequest" },
          type: "Property",
        },
        {
          messageId: "extraParam",
          data: { param: "timeout", func: "processRequest" },
          type: "Property",
        },
      ],
    },
  ],
});
