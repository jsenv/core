const installImportMetaCssBuild = (importMeta) => {
  const IMPORT_META_CSS_BUILD = "jsenv_import_meta_css_build";

  if (importMeta.css === IMPORT_META_CSS_BUILD) {
    return;
  }

  const stylesheetMap = new Map();
  const adopt = (url, value) => {
    const stylesheet = new CSSStyleSheet({ baseUrl: importMeta.url });
    stylesheet.replaceSync(value);
    stylesheetMap.set(url, stylesheet);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
  };
  const update = (url, value) => {
    stylesheetMap.get(url).replaceSync(value);
  };
  const remove = (url) => {
    const stylesheet = stylesheetMap.get(url);
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== stylesheet,
    );
    stylesheetMap.delete(url);
  };

  const currentCssSourceMap = new Map();
  Object.defineProperty(importMeta, "css", {
    configurable: true,
    get() {
      return IMPORT_META_CSS_BUILD;
    },
    set([value, url]) {
      if (value === undefined) {
        if (stylesheetMap.has(url)) {
          remove(url);
          currentCssSourceMap.delete(url);
        }
        return;
      }
      if (!stylesheetMap.has(url)) {
        adopt(url, value);
        currentCssSourceMap.set(url, value);
      } else if (currentCssSourceMap.get(url) !== value) {
        update(url, value);
        currentCssSourceMap.set(url, value);
      }
    },
  });
};

installImportMetaCssBuild(import.meta);const setBodyBackgroundColor = color => {
  import.meta.css = [         `
    body {
      background-color: ${color};
    }
  `, "/a.js"];
};

installImportMetaCssBuild(import.meta);const setBodyColor = color => {
  import.meta.css = [         `
    body {
      color: ${color};
    }
  `, "/b.js"];
};

installImportMetaCssBuild(import.meta);const setBodyFontSize = size => {
  import.meta.css = [         `
    body {
      font-size: ${size};
    }
  `, "/c.js"];
};





setBodyFontSize("16px");

const getBodyFontSize = () => window.getComputedStyle(document.body).fontSize;
const getBodyBackgroundColor = () =>
  window.getComputedStyle(document.body).backgroundColor;
const getBodyColor = () => window.getComputedStyle(document.body).color;
const captureStyles = () => {
  return {
    bodyFontSize: getBodyFontSize(),
    bodyBackgroundColor: getBodyBackgroundColor(),
    bodyColor: getBodyColor(),
  };
};


const at_start = captureStyles();





setBodyFontSize("42px");
setBodyBackgroundColor("red");
setBodyColor("blue");
const after_first_call = captureStyles();


setBodyBackgroundColor("green");
const after_second_call = captureStyles();

window.resolveResultPromise({
  at_start,
  after_first_call,
  after_second_call,
});