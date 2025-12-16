









const globalObject = typeof self === "object" ? self : process;
globalObject.__InlineContent__ = function (content, { type = "text/plain" }) {
  this.text = content;
  this.type = type;
};

const inlineContent = new __InlineContent__('body {\n  background-color: red;\n  background-image: url('+__v__("/other/jsenv.png")+');\n}\n', { type: "text/css" });
const stylesheet = new CSSStyleSheet({ baseUrl: "/src/main.css" });
stylesheet.replaceSync(inlineContent.text);

document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];



await new Promise((resolve) => setTimeout(resolve, 200));
const bodyBackgroundColor = getComputedStyle(document.body).backgroundColor;
console.log({ bodyBackgroundColor });


await new Promise((resolve) => setTimeout(resolve, 700));
const bodyBackgroundImage = getComputedStyle(document.body).backgroundImage;
console.log({ bodyBackgroundImage });

window.resolveResultPromise({
  bodyBackgroundColor,
  bodyBackgroundImage: bodyBackgroundImage.replace(
    window.origin,
    "window.origin",
  ),
});