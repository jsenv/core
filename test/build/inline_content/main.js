import { InlineContent } from "@jsenv/core/inline_content.js"

export const singleQuote = new InlineContent("'", { type: "text/plain" }).text
export const doubleQuote = new InlineContent('"', { type: "text/plain" }).text
export const lineEnding = new InlineContent("\n", { type: "text/plain" }).text
// prettier-ignore
export const lineEnding2 = new InlineContent('\n', { type: "text/plain" }).text
export const cssTextWithUrl = new InlineContent(
  "body { background-image: url('./jsenv.png'); }",
  { type: "text/css" },
).text
export const cssTextWithUrl2 = new InlineContent(
  'body { background-image: url("./jsenv.png"); }',
  { type: "text/css" },
).text

// export const txtD = new InlineContent(
//   `
//   toto`,
//   { type: "text/plain" },
// ).text
