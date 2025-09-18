import { RuleTester } from "eslint";
import { readFileSync } from "fs";
import { join } from "path";
import rule from "../../lib/rules/no-extra-params.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

const fixturesDir = join(import.meta.dirname, "fixtures");

// Load fixture files
const forwardRefValid = readFileSync(
  join(fixturesDir, "forwardref_valid.js"),
  "utf8",
);
const forwardRefInvalid = readFileSync(
  join(fixturesDir, "forwardref_invalid.js"),
  "utf8",
);
const memoValid = readFileSync(join(fixturesDir, "memo_valid.js"), "utf8");
const memoInvalid = readFileSync(join(fixturesDir, "memo_invalid.js"), "utf8");
const reactWrappersValid = readFileSync(
  join(fixturesDir, "react_wrappers_valid.js"),
  "utf8",
);
const reactWrappersInvalid = readFileSync(
  join(fixturesDir, "react_wrappers_invalid.js"),
  "utf8",
);
const bindValid = readFileSync(join(fixturesDir, "bind_valid.js"), "utf8");
const bindInvalid = readFileSync(join(fixturesDir, "bind_invalid.js"), "utf8");

ruleTester.run("no-extra-params - wrapper functions", rule, {
  valid: [
    {
      name: "forwardRef wrapper with valid props",
      code: forwardRefValid,
    },
    {
      name: "memo wrapper with valid props",
      code: memoValid,
    },
    {
      name: "React.forwardRef and React.memo with valid props",
      code: reactWrappersValid,
    },
    {
      name: "Function.bind wrapper with valid props",
      code: bindValid,
    },
  ],
  invalid: [
    {
      name: "forwardRef wrapper with extra prop",
      code: forwardRefInvalid,
      errors: [
        {
          messageId: "extraParam",
          data: { param: "extra", func: "WrappedComponent" },
        },
      ],
    },
    {
      name: "memo wrapper with extra prop",
      code: memoInvalid,
      errors: [
        {
          messageId: "extraParam",
          data: { param: "unused", func: "MemoizedComponent" },
        },
      ],
    },
    {
      name: "React wrappers with extra props",
      code: reactWrappersInvalid,
      errors: [
        {
          messageId: "extraParam",
          data: { param: "extra1", func: "ReactForwardRefComponent" },
        },
        {
          messageId: "extraParam",
          data: { param: "extra2", func: "ReactMemoComponent" },
        },
      ],
    },
    {
      name: "Function.bind wrapper with extra prop",
      code: bindInvalid,
      errors: [
        {
          messageId: "extraParam",
          data: { param: "extra", func: "boundFunction" },
        },
      ],
    },
  ],
});

console.log("✅ Wrapper functions tests passed!");
