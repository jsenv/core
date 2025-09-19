import { RuleTester } from "eslint";
import rule from "../../lib/rules/no-unknown-params.js";

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

ruleTester.run("no-unknown-params - inline wrapper functions", rule, {
  valid: [
    {
      name: "inline function expressions in wrappers with valid props",
      code: `// Test wrapper with inline function expression - valid case
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
      code: `// Test wrapper with inline function expression - invalid case
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
          messageId: "notFoundParam",
          data: { param: "extra1", func: "ForwardRefInline" },
        },
        {
          messageId: "notFoundParam",
          data: { param: "extra2", func: "MemoInline" },
        },
      ],
    },
  ],
});

console.log("✅ Inline wrapper functions tests passed!");
