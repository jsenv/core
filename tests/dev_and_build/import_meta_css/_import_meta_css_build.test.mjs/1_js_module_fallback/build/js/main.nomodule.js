System.register([__v__("/jsenv_core_packages.js")], function (_export, _context) {
  "use strict";

  var installImportMetaCssBuild$1, setBodyBackgroundColor, setBodyColor, setBodyFontSize, installImportMetaCssBuild, setBodyFontStyle, getBodyFontSize, getBodyFontStyle, getBodyBackgroundColor, getBodyColor, captureStyles, at_start, after_first_call, after_second_call;
  return {
    setters: [function (_buildJsenv_core_packagesJs) {}],
    execute: function () {
      installImportMetaCssBuild$1 = importMeta => {
        const IMPORT_META_CSS_BUILD = "jsenv_import_meta_css_build";
        if (importMeta.css === IMPORT_META_CSS_BUILD) {
          return;
        }
        const stylesheetMap = new Map();
        const adopt = (url, value) => {
          const stylesheet = new CSSStyleSheet({
            baseUrl: importMeta.url
          });
          stylesheet.replaceSync(value);
          stylesheetMap.set(url, stylesheet);
          document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
        };
        const update = (url, value) => {
          stylesheetMap.get(url).replaceSync(value);
        };
        const remove = url => {
          const stylesheet = stylesheetMap.get(url);
          document.adoptedStyleSheets = document.adoptedStyleSheets.filter(s => s !== stylesheet);
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
          }
        });
      };
      installImportMetaCssBuild$1(_context.meta);
      setBodyBackgroundColor = color => {
        _context.meta.css = [`
    body {
      background-color: ${color};
    }
  `, "/a.js"];
      };
      installImportMetaCssBuild$1(_context.meta);
      setBodyColor = color => {
        _context.meta.css = [`
    body {
      color: ${color};
    }
  `, "/b.js"];
      };
      installImportMetaCssBuild$1(_context.meta);
      setBodyFontSize = size => {
        _context.meta.css = [`
    body {
      font-size: ${size};
    }
  `, "/c.js"];
      };
      setBodyFontSize("16px");
      installImportMetaCssBuild$1(_context.meta);
      installImportMetaCssBuild = importMeta => {
        const IMPORT_META_CSS_BUILD = "jsenv_import_meta_css_build";
        if (importMeta.css === IMPORT_META_CSS_BUILD) {
          return;
        }
        const stylesheetMap = new Map();
        const adopt = (url, value) => {
          const stylesheet = new CSSStyleSheet({
            baseUrl: importMeta.url
          });
          stylesheet.replaceSync(value);
          stylesheetMap.set(url, stylesheet);
          document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
        };
        const update = (url, value) => {
          stylesheetMap.get(url).replaceSync(value);
        };
        const remove = url => {
          const stylesheet = stylesheetMap.get(url);
          document.adoptedStyleSheets = document.adoptedStyleSheets.filter(s => s !== stylesheet);
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
          }
        });
      };
      installImportMetaCssBuild(_context.meta);
      setBodyFontStyle = style => {
        _context.meta.css = [[`body { font-style: ${style}; }`, "/d.js"], "/d.js"];
      };
      getBodyFontSize = () => window.getComputedStyle(document.body).fontSize;
      getBodyFontStyle = () => window.getComputedStyle(document.body).fontStyle;
      getBodyBackgroundColor = () => window.getComputedStyle(document.body).backgroundColor;
      getBodyColor = () => window.getComputedStyle(document.body).color;
      captureStyles = () => {
        return {
          bodyFontSize: getBodyFontSize(),
          bodyFontStyle: getBodyFontStyle(),
          bodyBackgroundColor: getBodyBackgroundColor(),
          bodyColor: getBodyColor()
        };
      };
      at_start = captureStyles();
      setBodyFontSize("42px");
      setBodyBackgroundColor("red");
      setBodyColor("blue");
      setBodyFontStyle("italic");
      after_first_call = captureStyles();
      setBodyBackgroundColor("green");
      after_second_call = captureStyles();
      window.resolveResultPromise({
        at_start,
        after_first_call,
        after_second_call
      });
    }
  };
});