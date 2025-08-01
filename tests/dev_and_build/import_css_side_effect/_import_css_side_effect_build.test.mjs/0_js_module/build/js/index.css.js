import "/js/inline_content.js";

const inlineContent = new __InlineContent__("body {\n  background-color: green;\n}\n", { type: "text/css" });
const stylesheet = new CSSStyleSheet({ baseUrl: "/index.css" });
stylesheet.replaceSync(inlineContent.text);

export default stylesheet;