import { assert } from "@jsenv/assert";
import { prependContent } from "@jsenv/core/src/kitchen/prepend_content.js";

let result = null;
const urlInfoTransformerMock = {
  applyTransformations: (_, { content }) => {
    result = content;
  },
};
await prependContent(
  urlInfoTransformerMock,
  {
    type: "js_module",
    content: `console.log("hello");`,
    originalUrl: "file:///a.js",
  },
  {
    type: "js_classic",
    content: `console.log("banner");`,
  },
);
const actual = result;
const expected = `console.log("banner");
console.log("hello");`;
assert({ actual, expected });
