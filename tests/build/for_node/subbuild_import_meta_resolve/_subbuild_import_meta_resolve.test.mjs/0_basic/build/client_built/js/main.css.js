import "/client_built/js/inline_content.js";

const inlineContent = new __InlineContent__("body {\n  background: green;\n}\n", { type: "text/css" });
const stylesheet = new CSSStyleSheet();
stylesheet.replaceSync(inlineContent.text);

document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];

export default stylesheet;