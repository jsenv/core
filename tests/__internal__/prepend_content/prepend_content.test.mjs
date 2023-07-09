import { assert } from "@jsenv/assert";
import { prependContent } from "@jsenv/core/src/kitchen/prepend_content.js";

let result = null;
await prependContent(
  {
    type: "js_module",
    content: `console.log("hello");`,
    originalUrl: new URL("./a.js", import.meta.url).href,
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
