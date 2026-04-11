const installImportMetaCssBuild = (importMeta) => {
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
      return undefined;
    },
    set([value, { url }]) {
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

installImportMetaCssBuild(import.meta);const setCssA = color => {
  import.meta.css = [         `
    body {
      background-color: ${color};
    }
  `, {
    url: "/a.js"
  }];
};

installImportMetaCssBuild(import.meta);const setCssB = color => {
  import.meta.css = [         `
    body {
      color: ${color};
    }
  `, {
    url: "/b.js"
  }];
};


setCssA("red");
setCssB("blue");

const colorAfterInit = window.getComputedStyle(document.body).backgroundColor;
const fontColorAfterInit = window.getComputedStyle(document.body).color;


setCssA("green");

const colorAfterUpdate = window.getComputedStyle(document.body).backgroundColor;
const fontColorAfterUpdate = window.getComputedStyle(document.body).color;

window.resolveResultPromise({

  colorAfterInit,

  fontColorAfterInit,

  colorAfterUpdate,

  fontColorAfterUpdate,
});