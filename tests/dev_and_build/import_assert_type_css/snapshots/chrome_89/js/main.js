/* eslint-env browser,node */

const globalObject = typeof self === "object" ? self : process;
globalObject.__InlineContent__ = function (content, { type = "text/plain" }) {
  this.text = content;
  this.type = type;
};

const inlineContent = new __InlineContent__('body {\n  background-color: red;\n  background-image: url('+__v__("/other/jsenv.png")+');\n}\n', { type: "text/css" });
const stylesheet = new CSSStyleSheet();
stylesheet.replaceSync(inlineContent.text);

document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];

// on firefox + webkit we have to wait a bit,
// it seems the styles are applied on next js event loop
await new Promise((resolve) => setTimeout(resolve, 200));
const bodyBackgroundColor = getComputedStyle(document.body).backgroundColor;
console.log({ bodyBackgroundColor });

// let 700ms for the background image to load
await new Promise((resolve) => setTimeout(resolve, 700));
const bodyBackgroundImage = getComputedStyle(document.body).backgroundImage;
console.log({ bodyBackgroundImage });

window.resolveResultPromise({
  bodyBackgroundColor,
  bodyBackgroundImage,
});
