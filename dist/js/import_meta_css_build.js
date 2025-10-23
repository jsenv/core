import "file:///Users/dmail/Documents/dev/jsenv/core/packages/internal/plugin-transpilation/src/babel/new_stylesheet/client/new_stylesheet.js";

const installImportMetaCss = importMeta => {
  const stylesheet = new CSSStyleSheet({
    baseUrl: importMeta.url
  });
  let called = false;
  // eslint-disable-next-line accessor-pairs
  Object.defineProperty(importMeta, "css", {
    configurable: true,
    set(value) {
      if (called) {
        throw new Error("import.meta.css setter can only be called once");
      }
      called = true;
      stylesheet.replaceSync(value);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
    }
  });
};

export { installImportMetaCss };
