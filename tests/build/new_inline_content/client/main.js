// rename import to mimic what tersed does
import { InlineContent as InlineContentRenamed } from "@jsenv/core/src/plugins/inline_content_analysis/client/inline_content.js"

// prettier-ignore
export const singleQuoteEscaped =  new InlineContentRenamed('\'', { type: "text/plain" }).text
// prettier-ignore
export const doubleQuoteEscaped =  new InlineContentRenamed("\"", { type: "text/plain" }).text
export const singleQuote = new InlineContentRenamed("'", { type: "text/plain" })
  .text
export const doubleQuote = new InlineContentRenamed('"', { type: "text/plain" })
  .text
export const lineEnding = new InlineContentRenamed("\n", { type: "text/plain" })
  .text
// prettier-ignore
export const lineEnding2 = new InlineContentRenamed('\n', { type: "text/plain" }).text

export const complexInsideDoubleQuotes = new InlineContentRenamed("\n'😀'\n", {
  type: "text/plain",
}).text
export const complexInsideSingleQuotes = new InlineContentRenamed('\n"😀"\n', {
  type: "text/plain",
}).text

// prettier-ignore
export const cssTextWithUrl = new InlineContentRenamed(
  "\nbody { background-image: url(\"./jsenv.png\"); }\n",
  { type: "text/css" },
).text
// prettier-ignore
export const cssTextWithUrl2 = new InlineContentRenamed(
  '\nbody { background-image: url(\'./jsenv.png\'); }\n',
  { type: "text/css" },
).text

export const fromTemplate = new InlineContentRenamed(`"`, {
  type: "text/plain",
}).text
export const fromTemplate2 = new InlineContentRenamed(`'`, {
  type: "text/plain",
}).text
export const fromTemplate3 = new InlineContentRenamed(`\n'"`, {
  type: "text/plain",
}).text
export const fromTemplate4 = new InlineContentRenamed(
  `
'"
`,
  { type: "text/plain" },
).text
export const cssAndTemplate = new InlineContentRenamed(
  `
body {
  background-image: url("./jsenv.png");
  background-image: url('./jsenv.png');
  background-image: url(./jsenv.png);
}
`,
  { type: "text/css" },
).text

// mimic what terser might do during minification
export const whenInlined = new (function InlineContent(
  e,
  { type: t = "text/plain" },
) {
  this.text = e
  this.type = t
})(`body { background-image: url(./jsenv.png); }`, { type: "text/css" }).text
const A = InlineContentRenamed
export const whenRenamed = new A(
  `body { background-image: url(./jsenv.png); }`,
  { type: "text/css" },
).text

const blob = new Blob([`body { background-image: url(./jsenv.png); }`], {
  type: "text/css",
})
const blobUrl = URL.createObjectURL(blob)
const link = document.createElement("link")
link.rel = "stylesheet"
link.href = blobUrl
document.head.appendChild(link)
