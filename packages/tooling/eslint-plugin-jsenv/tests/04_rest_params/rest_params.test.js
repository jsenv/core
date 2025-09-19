import { RuleTester } from "eslint";
import { readFileSync } from "fs";
import { join } from "path";
import rule from "../../lib/rules/no-unknown-params.js";

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

const propertyRenameValidCode = readFileSync(
  join(fixturesDir, "property_rename_valid.js"),
  "utf8",
);
const propertyRenameInvalidCode = readFileSync(
  join(fixturesDir, "property_rename_invalid.js"),
  "utf8",
);

ruleTester.run("no-unknown-params - rest parameters", rule, {
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
    {
      name: "property renaming in destructuring - valid cases",
      code: propertyRenameValidCode,
    },
  ],
  invalid: [
    {
      name: "mixed rest and non-rest parameters - extra in non-rest",
      code: invalidCode,
      errors: [
        {
          messageId: "unknownParam",
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
          messageId: "unknownParam",
          data: { param: "debug", func: "initializeApp" },
          type: "Property",
        },
        {
          messageId: "unknownParam",
          data: { param: "timeout", func: "initializeApp" },
          type: "Property",
        },
        {
          messageId: "unknownParam",
          data: { param: "email", func: "createUser" },
          type: "Property",
        },
        {
          messageId: "unknownParam",
          data: { param: "age", func: "createUser" },
          type: "Property",
        },
        {
          messageId: "unknownParam",
          data: { param: "headers", func: "processRequest" },
          type: "Property",
        },
        {
          messageId: "unknownParam",
          data: { param: "timeout", func: "processRequest" },
          type: "Property",
        },
      ],
    },
    {
      name: "property renaming in destructuring - invalid cases",
      code: propertyRenameInvalidCode,
      errors: [
        {
          messageId: "unknownParam",
          data: { param: "b", func: "invalidRename1" },
          type: "Property",
        },
        {
          messageId: "unknownParam",
          data: { param: "c", func: "invalidRename2" },
          type: "Property",
        },
        {
          messageId: "unknownParam",
          data: { param: "x", func: "invalidMultipleRename" },
          type: "Property",
        },
        {
          messageId: "unknownParam",
          data: { param: "y", func: "invalidMultipleRename" },
          type: "Property",
        },
      ],
    },
  ],
});
