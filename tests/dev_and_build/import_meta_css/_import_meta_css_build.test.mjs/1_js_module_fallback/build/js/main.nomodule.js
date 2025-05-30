System.register([__v__("/jsenv_core_packages.js")], function (_export, _context) {
  "use strict";

  var cssText, stylesheet, adopted;
  return {
    setters: [function (_buildJsenv_core_packagesJs) {}],
    execute: function () {
      cssText = "";
      stylesheet = new CSSStyleSheet();
      adopted = false;
      Object.defineProperty(_context.meta, "css", {
        get() {
          return cssText;
        },
        set(value) {
          cssText = value;
          stylesheet.replaceSync(cssText);
          if (!adopted) {
            document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
            adopted = true;
          }
        }
      });
      _context.meta.css = `body {
  background-color: red;
}`;
      window.resolveResultPromise(window.getComputedStyle(document.body).backgroundColor);
    }
  };
});