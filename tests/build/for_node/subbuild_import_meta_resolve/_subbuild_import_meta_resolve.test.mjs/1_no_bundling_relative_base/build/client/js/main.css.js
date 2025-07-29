import "./inline_content.js";

const inlineContent = new __InlineContent__("body {\n  background: green;\n}\n", { type: "text/css" });
const stylesheet = new CSSStyleSheet({ baseUrl: "/client/main.css?side_effect" });
stylesheet.replaceSync(inlineContent.text);

document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];

export default stylesheet;