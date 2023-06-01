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
System.register([], function (_export, _context) {
  "use strict";

  var globalObject, inlineContent, stylesheet, bodyBackgroundColor, bodyBackgroundImage;
  return {
    setters: [],
    execute: async function () {
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
      inlineContent = new __InlineContent__('body {\n  background-color: red;\n  background-image: url('+__v__("/other/jsenv.png")+');\n}\n', {
        type: "text/css"
      });
      stylesheet = new CSSStyleSheet();
      stylesheet.replaceSync(inlineContent.text);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];

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