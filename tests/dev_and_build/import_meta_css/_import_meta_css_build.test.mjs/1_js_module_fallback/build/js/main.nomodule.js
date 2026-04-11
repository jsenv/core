System.register([__v__("/jsenv_core_packages.js")], function (_export, _context) {
  "use strict";

  var installImportMetaCssBuild;
  return {
    setters: [function (_buildJsenv_core_packagesJs) {}],
    execute: function () {
      installImportMetaCssBuild = importMeta => {
        const stylesheet = new CSSStyleSheet({
          baseUrl: importMeta.url
        });
        let called = false;
        Object.defineProperty(importMeta, "css", {
          configurable: true,
          set(value) {
            if (called) {
              throw new Error("import.meta.css setter can only be called once");
            }
            called = true;
            stylesheet.replaceSync(value);
            document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
          }
        });
      };
      installImportMetaCssBuild(_context.meta);
      _context.meta.css = `
  body {
    background-color: red;
  }
`;
      window.resolveResultPromise(window.getComputedStyle(document.body).backgroundColor);
    }
  };
});