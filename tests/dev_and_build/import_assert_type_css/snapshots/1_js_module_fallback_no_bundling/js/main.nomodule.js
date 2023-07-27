function _async(f) {
  return function () {
    for (var args = [], i = 0; i < arguments.length; i++) {
      args[i] = arguments[i];
    }
    try {
      return Promise.resolve(f.apply(this, args));
    } catch (e) {
      return Promise.reject(e);
    }
  };
}
function _await(value, then, direct) {
  if (direct) {
    return then ? then(value) : value;
  }
  if (!value || !value.then) {
    value = Promise.resolve(value);
  }
  return then ? value.then(then) : value;
}
System.register([__v__("/js/new_stylesheet.nomodule.js"), __v__("/js/main.css.nomodule.js")], function (_export, _context) {
  "use strict";

  var sheet, bodyBackgroundColor, bodyBackgroundImage;
  return {
    setters: [function (_packagesInternalPluginTranspilationSrcBabelNew_stylesheetClientNew_stylesheetJs) {}, function (_srcMainCssAs_css_module) {
      sheet = _srcMainCssAs_css_module.default;
    }],
    execute: async function () {
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

      // on firefox + webkit we have to wait a bit,
      // it seems the styles are applied on next js event loop
      return _await(new Promise(resolve => setTimeout(resolve, 200)), function () {
        // let 700ms for the background image to load
        bodyBackgroundColor = getComputedStyle(document.body).backgroundColor;
        console.log({
          bodyBackgroundColor
        });
        return _await(new Promise(resolve => setTimeout(resolve, 700)), function () {
          bodyBackgroundImage = getComputedStyle(document.body).backgroundImage;
          console.log({
            bodyBackgroundImage
          });
          window.resolveResultPromise({
            bodyBackgroundColor,
            bodyBackgroundImage
          });
        });
      });
    }
  };
});