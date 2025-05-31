System.register([__v__("/jsenv_core_packages.js")], function (_export, _context) {
  "use strict";

  var installImportMetaCss;
  return {
    setters: [function (_buildJsenv_core_packagesJs) {}],
    execute: function () {
      installImportMetaCss = importMeta => {
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
      installImportMetaCss(_context.meta);
      _context.meta.css = `body {
  background-color: red;
}`;
      window.resolveResultPromise(window.getComputedStyle(document.body).backgroundColor);
    }
  };
});