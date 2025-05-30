const installImportMetaCss = (importMeta) => {
  let cssText = "";
  let stylesheet = new CSSStyleSheet();
  let adopted = false;

  const css = {
    toString: () => cssText,
    update: (value) => {
      cssText = value;
      stylesheet.replaceSync(cssText);
    },
    inject: () => {
      if (!adopted) {
        document.adoptedStyleSheets = [
          ...document.adoptedStyleSheets,
          stylesheet,
        ];
        adopted = true;
      }
    },
    remove: () => {
      if (adopted) {
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
          (s) => s !== stylesheet,
        );
        adopted = false;
      }
    },
  };

  Object.defineProperty(importMeta, "css", {
    get() {
      return css;
    },
    set(value) {
      css.update(value);
      css.inject();
    },
  });

  return css.remove;
};

installImportMetaCss(import.meta);import.meta.css =         `body {
  background-color: red;
}`;

window.resolveResultPromise(
  window.getComputedStyle(document.body).backgroundColor,
);