System.register([__v__("/js/new_stylesheet.nomodule.js")], function (_export, _context) {
  "use strict";

  var globalObject, inlineContent, stylesheet;
  return {
    setters: [function (_packagesInternalPluginTranspilationSrcBabelNew_stylesheetClientNew_stylesheetJs) {}],
    execute: function () {
      /* eslint-env browser,node */
      /*
       * This file does not use export const InlineContent = function() {} on purpose:
       * - An export would be renamed by rollup,
       *   making it harder to statically detect new InlineContent() calls
       * - An export would be renamed by terser
       *   here again it becomes hard to detect new InlineContent() calls
       * Instead it sets "__InlineContent__" on the global object and terser is configured by jsenv
       * to preserve the __InlineContent__ global variable name
       */
      globalObject = typeof self === "object" ? self : process;
      globalObject.__InlineContent__ = function (content, {
        type = "text/plain"
      }) {
        this.text = content;
        this.type = type;
      };
      inlineContent = new __InlineContent__('@font-face {\n  font-family: Roboto;\n  font-style: normal;\n  font-weight: 400;\n  src: local(Roboto), url('+__v__("/other/roboto_v27_latin_regular.woff2")+') format("woff2");\n}\n\nbody {\n  font-family: Roboto;\n}\n', {
        type: "text/css"
      });
      _export("default", stylesheet = new CSSStyleSheet());
      stylesheet.replaceSync(inlineContent.text);
    }
  };
});