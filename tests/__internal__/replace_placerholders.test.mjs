import { assert } from "@jsenv/assert";
import { replacePlaceholders } from "@jsenv/core/src/kitchen/url_graph/url_info_injections.js";

const result = replacePlaceholders(
  `const foo = __FOO__
const t = __FOO__
const bar = __BAR__`,
  {
    __FOO__: "hello",
    __BAR__: "world",
  },
  {
    type: "js_module",
  },
);
const actual = result.content;
const expect = `const foo = "hello"
const t = "hello"
const bar = "world"`;
assert({ actual, expect });
