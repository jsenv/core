import { RuleTester } from "eslint";
import rule from "../../lib/rules/no-unknown-params.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-unknown-params - unknown functions", rule, {
  valid: [
    {
      name: "unknown functions should be ignored - no errors expected",
      code: `function validKnownFunction({ name }) {
  console.log(name);
}

window.unknownGlobal({ a: 1, b: 2, c: 3, extra: "ignored" });
external.method({ x: true, y: false, unused: "ignored" });

validKnownFunction({ name: "test" });`,
    },
  ],
  invalid: [
    {
      name: "known functions analyzed, unknown functions ignored",
      code: `function knownFunction({ name }) {
  console.log(name);
}

window.unknownGlobal({ a: 1, b: 2, c: 3 });
external.method({ x: true, y: false });

knownFunction({ name: "test", extra: "should be flagged" });`,
      output: `function knownFunction({ name }) {
  console.log(name);
}

window.unknownGlobal({ a: 1, b: 2, c: 3 });
external.method({ x: true, y: false });

knownFunction({ name: "test" });`,
      errors: [
        {
          messageId: "notFoundParam",
          data: { param: "extra", func: "knownFunction" },
        },
      ],
    },
  ],
});

console.log("✅ Unknown functions tests passed!");
