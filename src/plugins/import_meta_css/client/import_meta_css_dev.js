export const installImportMetaCssDev = (importMeta) => {
  let currentCssSource;
  let cssText = "";
  let stylesheet;
  let adopted = false;

  const css = {
    toString: () => cssText,
    update: (value) => {
      if (currentCssSource === value) {
        return;
      }
      currentCssSource = value;
      cssText = value;
      cssText += `
/* sourceURL=${importMeta.url} */
/* inlined from ${importMeta.url} */`;
      if (currentCssSource === undefined) {
        stylesheet = new CSSStyleSheet({ baseUrl: importMeta.url });
        stylesheet.replaceSync(cssText);
        css.inject();
      } else {
        stylesheet.replaceSync(cssText);
      }
    },
    inject: () => {
      if (adopted) {
        return;
      }
      document.adoptedStyleSheets = [
        ...document.adoptedStyleSheets,
        stylesheet,
      ];
      adopted = true;
    },
    remove: () => {
      if (!adopted) {
        return;
      }
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (s) => s !== stylesheet,
      );
      adopted = false;
    },
  };

  Object.defineProperty(importMeta, "css", {
    configurable: true,
    get() {
      return css;
    },
    set(value) {
      css.update(value);
    },
  });

  return css.remove;
};
