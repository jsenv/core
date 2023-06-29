System.register([__v__("/js/new_stylesheet.nomodule.js"), __v__("/js/inline_content.nomodule.js")], function (_export, _context) {
  "use strict";

  var inlineContent, stylesheet;
  return {
    setters: [function (_packagesInternalPluginTranspilationSrcBabelNew_stylesheetClientNew_stylesheetJs) {}, function (_srcKitchenClientInline_contentJs) {}],
    execute: function () {
      inlineContent = new __InlineContent__('body {\n  background-color: red;\n  background-image: url('+__v__("/other/jsenv.png")+');\n}\n', {
        type: "text/css"
      });
      stylesheet = new CSSStyleSheet();
      stylesheet.replaceSync(inlineContent.text);
      _export("default", stylesheet);
    }
  };
});