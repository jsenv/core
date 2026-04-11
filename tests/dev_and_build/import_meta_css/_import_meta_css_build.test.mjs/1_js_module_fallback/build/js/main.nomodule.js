System.register([__v__("/jsenv_core_packages.js")], function (_export, _context) {
  "use strict";

  var IMPORT_META_CSS_BUILD, installImportMetaCssBuild, setBodyBackgroundColor, setBodyColor, setBodyFontSize, bodyBackgroundColorAfterInit, bodyColorAfterInit, bodyFontSizeAfterInit, bodyBackgroundColorAfterUpdate, bodyColorAfterUpdate, bodyFontSizeAfterUpdate;
  return {
    setters: [function (_buildJsenv_core_packagesJs) {}],
    execute: function () {
      IMPORT_META_CSS_BUILD = "jsenv_import_meta_css_build";
      installImportMetaCssBuild = importMeta => {
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
          set([value, {
            url
          }]) {
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
      setBodyBackgroundColor = color => {
        _context.meta.css = [`
    body {
      background-color: ${color};
    }
  `, {
          url: "/a.js"
        }];
      };
      installImportMetaCssBuild(_context.meta);
      setBodyColor = color => {
        _context.meta.css = [`
    body {
      color: ${color};
    }
  `, {
          url: "/b.js"
        }];
      };
      installImportMetaCssBuild(_context.meta);
      setBodyFontSize = size => {
        _context.meta.css = [`
    body {
      font-size: ${size};
    }
  `, {
          url: "/c.js"
        }];
      };
      setBodyFontSize("42px");
      setBodyFontSize("42px");
      setBodyBackgroundColor("red");
      setBodyColor("blue");
      bodyBackgroundColorAfterInit = window.getComputedStyle(document.body).backgroundColor;
      bodyColorAfterInit = window.getComputedStyle(document.body).color;
      bodyFontSizeAfterInit = window.getComputedStyle(document.body).fontSize;
      setBodyBackgroundColor("green");
      bodyBackgroundColorAfterUpdate = window.getComputedStyle(document.body).backgroundColor;
      bodyColorAfterUpdate = window.getComputedStyle(document.body).color;
      bodyFontSizeAfterUpdate = window.getComputedStyle(document.body).fontSize;
      window.resolveResultPromise({
        bodyBackgroundColorAfterInit,
        bodyColorAfterInit,
        bodyFontSizeAfterInit,
        bodyBackgroundColorAfterUpdate,
        bodyColorAfterUpdate,
        bodyFontSizeAfterUpdate
      });
    }
  };
});