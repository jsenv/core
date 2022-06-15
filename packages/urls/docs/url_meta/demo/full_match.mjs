import { URL_META } from "@jsenv/urls"

const fullMatch = URL_META.applyPatternMatching({
  pattern: "file:///**/*",
  url: "file:///Users/directory/file.js",
})
console.log(JSON.stringify(fullMatch, null, "  "))
