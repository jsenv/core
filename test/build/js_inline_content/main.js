import { InlineContent } from "@jsenv/core/inline_content.js"

// prettier-ignore
export const singleQuoteEscaped =  new InlineContent('\'', { type: "text/plain" }).text
// prettier-ignore
export const doubleQuoteEscaped =  new InlineContent("\"", { type: "text/plain" }).text
export const singleQuote = new InlineContent("'", { type: "text/plain" }).text
export const doubleQuote = new InlineContent('"', { type: "text/plain" }).text
export const lineEnding = new InlineContent("\n", { type: "text/plain" }).text
// prettier-ignore
export const lineEnding2 = new InlineContent('\n', { type: "text/plain" }).text

export const complexInsideDoubleQuotes = new InlineContent("\n'😀'\n", {
  type: "text/plain",
}).text
export const complexInsideSingleQuotes = new InlineContent('\n"😀"\n', {
  type: "text/plain",
}).text

// prettier-ignore
export const cssTextWithUrl = new InlineContent(
  "\nbody { background-image: url(\"./jsenv.png\"); }\n",
  { type: "text/css" },
).text
// prettier-ignore
export const cssTextWithUrl2 = new InlineContent(
  '\nbody { background-image: url(\'./jsenv.png\'); }\n',
  { type: "text/css" },
).text

export const fromTemplate = new InlineContent(`"`, { type: "text/plain" }).text
export const fromTemplate2 = new InlineContent(`'`, { type: "text/plain" }).text
export const fromTemplate3 = new InlineContent(`\n'"`, { type: "text/plain" })
  .text
export const fromTemplate4 = new InlineContent(
  `
'"
`,
  { type: "text/plain" },
).text
export const cssAndTemplate = new InlineContent(
  `
body {
  background-image: url("./jsenv.png");
  background-image: url('./jsenv.png');
  background-image: url(./jsenv.png);
}
`,
  { type: "text/css" },
).text
