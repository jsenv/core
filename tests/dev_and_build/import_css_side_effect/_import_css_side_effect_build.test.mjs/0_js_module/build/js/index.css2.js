import "/js/inline_content.js";

const inlineContent = new __InlineContent__("body {\n  background-color: green;\n}\n", { type: "text/css" });
const stylesheet = new CSSStyleSheet({ baseUrl: "/index.css?side_effect" });
stylesheet.replaceSync(inlineContent.text);

document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];

export default stylesheet;