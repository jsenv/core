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

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== stylesheet,
    );
    adopted = false;
  });
}
