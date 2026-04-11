const IMPORT_META_CSS_DEV = Symbol.for("import_meta_css_dev");

const installImportMetaCssDev = (importMeta) => {
  if (importMeta.css === IMPORT_META_CSS_DEV) {
    return;
  }
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
  Object.defineProperty(importMeta, "css", {
    configurable: true,
    get() {
      return IMPORT_META_CSS_DEV;
    },
    set(value) {
      if (value === undefined) {
        if (stylesheet) {
          remove();
          stylesheet = undefined;
          currentCssSource = undefined;
        }
        return;
      }
      if (!stylesheet) {
        adopt(value);
        currentCssSource = value;
      } else if (currentCssSource !== value) {
        update(value);
        currentCssSource = value;
      }
    },
  });
};

export { installImportMetaCssDev };
