let cssText = "";
let stylesheet = new CSSStyleSheet();
let adopted = false;

Object.defineProperty(import.meta, "css", {
  get() {
    return cssText;
  },
  set(value) {
    cssText = value;
    stylesheet.replaceSync(cssText);
    if (!adopted) {
      document.adoptedStyleSheets = [
        ...document.adoptedStyleSheets,
        stylesheet,
      ];
      adopted = true;
    }
  },
});

import.meta.css =         `body {
  background-color: red;
}`;

window.resolveResultPromise(
  window.getComputedStyle(document.body).backgroundColor,
);