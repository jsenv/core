export const installImportMetaCssDev = (importMeta) => {
  // useless today but browser might catch up to display it in devtools
  const addUrlInfo = (cssText) => {
    let cssTextWithUrlInfo = cssText;
    cssTextWithUrlInfo += `
/* sourceURL=${importMeta.url} */
/* inlined from ${importMeta.url} */`;
    return cssTextWithUrlInfo;
  };

  let stylesheet;
  const adopt = (value) => {
    stylesheet = new CSSStyleSheet({ baseUrl: importMeta.url });
    stylesheet.replaceSync(addUrlInfo(value));
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
  };
  const update = (value) => {
    stylesheet.replaceSync(addUrlInfo(value));
  };
  const remove = () => {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== stylesheet,
    );
  };

  let currentCssSource;
  let adopted = false;
  Object.defineProperty(importMeta, "css", {
    configurable: true,
    get() {
      return undefined;
    },
    set(value) {
      if (value === undefined) {
        if (adopted) {
          remove();
          adopted = false;
          currentCssSource = undefined;
        }
        return;
      }
      if (!adopted) {
        adopt(value);
        currentCssSource = value;
      } else if (currentCssSource !== value) {
        update(value);
        currentCssSource = value;
      }
    },
  });
};
