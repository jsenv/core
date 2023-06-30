System.register(["/js/new_stylesheet.nomodule.js", "/js/inline_content.nomodule.js"], function (_export, _context) {
  "use strict";

  var inlineContent, stylesheet;
  return {
    setters: [function (_packagesInternalPluginTranspilationSrcBabelNew_stylesheetClientNew_stylesheetJs) {}, function (_srcKitchenClientInline_contentJs) {}],
    execute: function () {
      inlineContent = new __InlineContent__("body {\n  font-size: 20px;\n}\n", {
        type: "text/css"
      });
      stylesheet = new CSSStyleSheet();
      stylesheet.replaceSync(inlineContent.text);
      _export("default", stylesheet);
    }
  };
});