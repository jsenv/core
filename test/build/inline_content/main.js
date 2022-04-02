import { InlineContent } from "@jsenv/core/inline_content.js"

// prettier-ignore
export const txtA = new InlineContent('\n{}', { type: "text/plain" }).text
export const txtB = new InlineContent("\n{}", { type: "text/plain" }).text
export const txtC = new InlineContent(`\n{}`, { type: "text/plain" }).text
export const txtD = new InlineContent(
  `
  toto`,
  { type: "text/plain" },
).text
// export const txtB = new InlineContent("\n\"'{}\n", { type: "text/plain" }).raw

// export const txtC = new InlineContent("\n\"'`{}\n", { type: "text/plain" }).raw

export const cssTextA = new InlineContent(
  `
body {
  background-color: red;
  background-image: url(./jsenv.png);
  background-image: url("./jsenv.png");
}`,
  { type: "text/css" },
).text
export const cssTextB = new InlineContent(
  "body { background-image: url('./jsenv.png'); }",
  { type: "text/css" },
).text
