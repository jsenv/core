import { InlineContent } from "@jsenv/core/inline_content.js"

// prettier-ignore
// export const txtA = new InlineContent('\n{}', { type: "text/plain" }).text
// export const txtB = new InlineContent("\n{}", { type: "text/plain" }).text
// export const txtC = new InlineContent(`\n{}`, { type: "text/plain" }).text
// export const txtD = new InlineContent(
//   `
//   toto`,
//   { type: "text/plain" },
// ).text

// TODO: fix "txtE" below:
//   - should be dosable with "escapeCharIsNotAlreadyEscaped"
//   to escape all `'` but for some reason, when replacing code with magic source
//   the string is not correctly replaced even when adjusting the start/end position
export const txtE = new InlineContent("'", { type: "text/plain" }).text

// export const cssTextA = new InlineContent(
//   `
// body {
//   background-color: red;
//   background-image: url(./jsenv.png);
//   background-image: url("./jsenv.png");
//   background-image: url('./jsenv.png');
// }`,
//   { type: "text/css" },
// ).text
// export const cssTextB = new InlineContent(
//   "body { background-image: url('./jsenv.png'); }",
//   { type: "text/css" },
// ).text
