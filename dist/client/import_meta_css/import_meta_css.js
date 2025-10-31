const installImportMetaCss = (importMeta) => {
  let cssText = "";
  let stylesheet = new CSSStyleSheet({ baseUrl: importMeta.url });
  let adopted = false;

  const css = {
    toString: () => cssText,
    update: (value) => {
      cssText = value;
      cssText += `
/* sourceURL=${importMeta.url} */
/* inlined from ${importMeta.url} */`;
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

export { installImportMetaCss };
