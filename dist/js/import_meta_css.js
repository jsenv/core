import "file:///Users/dmail/Documents/dev/jsenv/core/packages/internal/plugin-transpilation/src/babel/new_stylesheet/client/new_stylesheet.js";

const installImportMetaCss = importMeta => {
  let cssText = "";
  let stylesheet = new CSSStyleSheet();
  let adopted = false;
  const css = {
    toString: () => cssText,
    update: value => {
      cssText = value;
      stylesheet.replaceSync(cssText);
    },
    inject: () => {
      if (!adopted) {
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
        adopted = true;
      }
    },
    remove: () => {
      if (adopted) {
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter(s => s !== stylesheet);
        adopted = false;
      }
    }
  };
  Object.defineProperty(importMeta, "css", {
    get() {
      return css;
    },
    set(value) {
      css.update(value);
      css.inject();
    }
  });
  return css.remove;
};

export { installImportMetaCss };
