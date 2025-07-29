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
System.register([__v__("/jsenv_core_packages.js")], function (_export, _context) {
  "use strict";

  var globalObject, inlineContent, stylesheet, bodyBackgroundColor, bodyBackgroundImage;
  return {
    setters: [function (_buildJsenv_core_packagesJs) {}],
    execute: async function () {
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
      stylesheet = new CSSStyleSheet({
        baseUrl: "/src/main.css"
      });
      stylesheet.replaceSync(inlineContent.text);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
      return _await(new Promise(resolve => setTimeout(resolve, 200)), function () {
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
            bodyBackgroundImage: bodyBackgroundImage.replace(window.origin, "window.origin")
          });
        });
      });
    }
  };
});