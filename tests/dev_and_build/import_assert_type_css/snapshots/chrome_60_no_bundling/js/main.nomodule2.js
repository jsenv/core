System.register([__v__("/js/new_stylesheet.nomodule.js"), __v__("/js/inline_content.nomodule.js")], function (_export, _context) {
  "use strict";

  var InlineContent, inlineContent, stylesheet;
  return {
    setters: [function (_srcPluginsTranspilationBabelNew_stylesheetClientNew_stylesheetJs) {}, function (_srcPluginsInline_content_analysisClientInline_contentJs) {
      InlineContent = _srcPluginsInline_content_analysisClientInline_contentJs.InlineContent;
    }],
    execute: function () {
      inlineContent = new InlineContent('body {\n  background-color: red;\n  background-image: url('+__v__("/other/jsenv.png")+');\n}\n', {
        type: "text/css"
      });
      stylesheet = new CSSStyleSheet();
      stylesheet.replaceSync(inlineContent.text);
      _export("default", stylesheet);
    }
  };
});