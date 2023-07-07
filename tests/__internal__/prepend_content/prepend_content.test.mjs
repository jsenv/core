import { assert } from "@jsenv/assert";
import { prependContent } from "@jsenv/core/src/kitchen/prepend_content.js";

let result = null;
await prependContent(
  {
    type: "js_module",
    content: `console.log("hello");`,
    originalUrl: "file:///a.js",
    mutateContent: ({ content }) => {
      result = content;
    },
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
