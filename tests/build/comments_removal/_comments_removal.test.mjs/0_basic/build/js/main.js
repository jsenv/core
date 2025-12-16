









const globalObject = typeof self === "object" ? self : process;
globalObject.__InlineContent__ = function (content, { type = "text/plain" }) {
  this.text = content;
  this.type = type;
};

const inlineContent = new __InlineContent__("body {\n  background: red;\n}\n", { type: "text/css" });
const stylesheet = new CSSStyleSheet({ baseUrl: "/main.css?side_effect" });
stylesheet.replaceSync(inlineContent.text);

document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];


console.log("YEAH");