import { URL_META } from "@jsenv/url-meta";

const fullMatch = URL_META.applyPatternMatching({
  pattern: "file:///**/*",
  url: "file:///Users/directory/file.js",
});
console.log(JSON.stringify(fullMatch, null, "  "));
