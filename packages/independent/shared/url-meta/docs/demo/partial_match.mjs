import { URL_META } from "@jsenv/url-meta";

const partialMatch = URL_META.applyPatternMatching({
  pattern: "file:///*.js",
  url: "file:///file.jsx",
});
console.log(JSON.stringify(partialMatch, null, "  "));
