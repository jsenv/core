import "/js/inline_content.js";

const inlineContent = new __InlineContent__('body {\n  background-color: red;\n  background-image: url('+__v__("/other/jsenv.png")+');\n}\n', { type: "text/css" });
const stylesheet = new CSSStyleSheet();
stylesheet.replaceSync(inlineContent.text);
export default stylesheet;