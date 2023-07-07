System.register([__v__("/js/new_stylesheet.nomodule.js"), __v__("/js/inline_content.nomodule.js")], function (_export, _context) {
  "use strict";

  var inlineContent, stylesheet;
  return {
    setters: [function (_packagesInternalPluginTranspilationSrcBabelNew_stylesheetClientNew_stylesheetJs) {}, function (_srcKitchenClientInline_contentJs) {}],
    execute: function () {
      inlineContent = new __InlineContent__('@font-face {\n  font-family: Roboto;\n  font-style: normal;\n  font-weight: 400;\n  src: local(Roboto), url('+__v__("/other/roboto_v27_latin_regular.woff2")+') format("woff2");\n}\n\nbody {\n  font-family: Roboto;\n}\n', {
        type: "text/css"
      });
      stylesheet = new CSSStyleSheet();
      stylesheet.replaceSync(inlineContent.text);
      _export("default", stylesheet);
    }
  };
});