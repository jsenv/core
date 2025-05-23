import { assert } from "@jsenv/assert";
import { injectPlaceholderReplacements } from "@jsenv/core/src/kitchen/url_graph/url_info_injections.js";

const result = injectPlaceholderReplacements(
  `const foo = __FOO__
const t = __FOO__
const bar = __BAR__`,
  [
    {
      key: "__FOO__",
      value: "hello",
    },
    {
      key: "__BAR__",
      value: "world",
    },
  ],
  {
    type: "js_module",
  },
);
const actual = result.content;
const expect = `const foo = "hello"
const t = "hello"
const bar = "world"`;
assert({ actual, expect });
