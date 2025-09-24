import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

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

ruleTester.run(
  "no-unknown-params - inline wrapper functions",
  noUnknownParamsRule,
  {
    valid: [
      {
        name: "inline function expressions in wrappers with valid props",
      options: [{ reportAllUnknownParams: true }],        code: `// Test wrapper with inline function expression - valid case
const ValidForwardRef = forwardRef(({ title }) => {
  return <div>{title}</div>;
});

const ValidMemo = memo(({ name }) => {
  return <span>{name}</span>;
});

// Valid usage
ValidForwardRef({ title: "Hello" });
ValidMemo({ name: "John" });`,
      },
    ],
    invalid: [
      {
        name: "inline function expressions in wrappers with extra props",
      options: [{ reportAllUnknownParams: true }],        code: `// Test wrapper with inline function expression - invalid case
const ForwardRefInline = forwardRef(({ title }) => {
  return <div>{title}</div>;
});

const MemoInline = memo(({ name }) => {
  return <span>{name}</span>;
});

// Invalid usage - extra props should be detected
ForwardRefInline({ title: "Hello", extra1: "unused" });
MemoInline({ name: "John", extra2: "unused" });`,
        output: `// Test wrapper with inline function expression - invalid case
const ForwardRefInline = forwardRef(({ title }) => {
  return <div>{title}</div>;
});

const MemoInline = memo(({ name }) => {
  return <span>{name}</span>;
});

// Invalid usage - extra props should be detected
ForwardRefInline({ title: "Hello" });
MemoInline({ name: "John" });`,
        errors: [
          {
            messageId: "not_found_param",
            data: { param: "extra1", func: "ForwardRefInline" },
          },
          {
            messageId: "not_found_param",
            data: { param: "extra2", func: "MemoInline" },
          },
        ],
      },
    ],
  },
);

console.log("✅ Inline wrapper functions tests passed!");
