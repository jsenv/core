
import "/js/inline_content.js";


export const singleQuoteEscaped =  new __InlineContent__('\'', { type: "text/plain" }).text

export const doubleQuoteEscaped =  new __InlineContent__("\"", { type: "text/plain" }).text
export const singleQuote = new __InlineContent__("'", { type: "text/plain" })
  .text;
export const doubleQuote = new __InlineContent__('"', { type: "text/plain" })
  .text;
export const lineEnding = new __InlineContent__("\n", { type: "text/plain" })
  .text;

export const lineEnding2 = new __InlineContent__('\n', { type: "text/plain" }).text

export const complexInsideDoubleQuotes = new __InlineContent__("\n'😀'\n", {
  type: "text/plain",
}).text;
export const complexInsideSingleQuotes = new __InlineContent__('\n"😀"\n', {
  type: "text/plain",
}).text;


export const cssTextWithUrl = new __InlineContent__(
  "\nbody { background-image: url("+__v__("/other/jsenv.png")+"); }\n",
  { type: "text/css" },
).text

export const cssTextWithUrl2 = new __InlineContent__(
  '\nbody { background-image: url('+__v__("/other/jsenv.png")+'); }\n',
  { type: "text/css" },
).text

export const fromTemplate = new __InlineContent__(`"`, {
  type: "text/plain",
}).text;
export const fromTemplate2 = new __InlineContent__(`'`, {
  type: "text/plain",
}).text;
export const fromTemplate3 = new __InlineContent__(`
'"`, {
  type: "text/plain",
}).text;
export const fromTemplate4 = new __InlineContent__(
  `
'"
`,
  { type: "text/plain" },
).text;
export const cssAndTemplate = new __InlineContent__(
  `
body {
  background-image: url(`+__v__("/other/jsenv.png")+`);
  background-image: url(`+__v__("/other/jsenv.png")+`);
  background-image: url(`+__v__("/other/jsenv.png")+`);
}
`,
  { type: "text/css" },
).text;

const blob = new Blob([`body { background-image: url(`+__v__("/other/jsenv.png")+`); }`], {
  type: "text/css",
});
const blobUrl = URL.createObjectURL(blob);
const link = document.createElement("link");
link.rel = "stylesheet";
link.href = blobUrl;
document.head.appendChild(link);