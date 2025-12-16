









const globalObject = typeof self === "object" ? self : process;
globalObject.__InlineContent__ = function (content, { type = "text/plain" }) {
  this.text = content;
  this.type = type;
};

const inlineContent = new __InlineContent__("body {\n  font-size: 20px;\n}\n", { type: "text/css" });
const stylesheet = new CSSStyleSheet({ baseUrl: "/style.css" });
stylesheet.replaceSync(inlineContent.text);

document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];


await new Promise((resolve) => {
  setTimeout(resolve, 5000);
});
window.resolveResultPromise(getComputedStyle(document.body).fontSize);