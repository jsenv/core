(function () {
  'use strict';

  var nativeTypeOf = function nativeTypeOf(obj) {
    return typeof obj;
  };

  var customTypeOf = function customTypeOf(obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  };

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? nativeTypeOf : customTypeOf;

  var setStyles = function setStyles(element, styles) {
    var elementStyle = element.style;
    var restoreStyles = Object.keys(styles).map(function (styleName) {
      var restore;

      if (styleName in elementStyle) {
        var currentStyle = elementStyle[styleName];

        restore = function restore() {
          elementStyle[styleName] = currentStyle;
        };
      } else {
        restore = function restore() {
          delete elementStyle[styleName];
        };
      }

      elementStyle[styleName] = styles[styleName];
      return restore;
    });
    return function () {
      restoreStyles.forEach(function (restore) {
        return restore();
      });
    };
  };
  var setAttributes = function setAttributes(element, attributes) {
    Object.keys(attributes).forEach(function (name) {
      element.setAttribute(name, attributes[name]);
    });
  };

  function _await(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  var TOOLBAR_BUILD_RELATIVE_URL = "dist/toolbar/toolbar_b8b4d9c7.html";

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

  var jsenvLogoSvgUrl = new URL("assets/jsenv-logo_188b9ca6.svg", document.currentScript && document.currentScript.src || document.baseURI);

  var injectToolbar = _async(function () {
    return _await(new Promise(function (resolve) {
      if (window.requestIdleCallback) {
        window.requestIdleCallback(resolve);
      } else {
        window.requestAnimationFrame(resolve);
      }
    }), function () {
      var placeholder = getToolbarPlaceholder();
      var iframe = document.createElement("iframe");
      setAttributes(iframe, {
        tabindex: -1,
        // sandbox: "allow-forms allow-modals allow-pointer-lock allow-popups allow-presentation allow-same-origin allow-scripts allow-top-navigation-by-user-activation",
        // allow: "accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; vr",
        allowtransparency: true
      });
      setStyles(iframe, {
        "position": "fixed",
        "zIndex": 1000,
        "bottom": 0,
        "left": 0,
        "width": "100%",
        "height": 0,

        /* ensure toolbar children are not focusable when hidden */
        "visibility": "hidden",
        "transition-duration": "300ms",
        "transition-property": "height, visibility",
        "border": "none"
      });
      var iframeLoadedPromise = iframeToLoadedPromise(iframe);
      var jsenvToolbarHtmlServerUrl = "/".concat(TOOLBAR_BUILD_RELATIVE_URL); // set iframe src BEFORE putting it into the DOM (prevent firefox adding an history entry)

      iframe.setAttribute("src", jsenvToolbarHtmlServerUrl);
      placeholder.parentNode.replaceChild(iframe, placeholder);
      return _await(iframeLoadedPromise, function () {
        iframe.removeAttribute("tabindex");
        var div = document.createElement("div");
        div.innerHTML = "\n<div id=\"jsenv-toolbar-trigger\">\n  <svg id=\"jsenv-toolbar-trigger-icon\">\n    <use xlink:href=\"".concat(jsenvLogoSvgUrl, "#jsenv-logo\"></use>\n  </svg>\n  <style>\n    #jsenv-toolbar-trigger {\n      display: block;\n      overflow: hidden;\n      position: fixed;\n      z-index: 1000;\n      bottom: -32px;\n      right: 20px;\n      height: 40px;\n      width: 40px;\n      padding: 0;\n      margin: 0;\n      border-radius: 5px 5px 0 0;\n      border: 1px solid rgba(0, 0, 0, 0.33);\n      border-bottom: none;\n      box-shadow: 0px 0px 6px 2px rgba(0, 0, 0, 0.46);\n      background: transparent;\n      text-align: center;\n      transition: 600ms;\n    }\n\n    #jsenv-toolbar-trigger:hover {\n      cursor: pointer;\n    }\n\n    #jsenv-toolbar-trigger[data-expanded] {\n      bottom: 0;\n    }\n\n    #jsenv-toolbar-trigger-icon {\n      width: 35px;\n      height: 35px;\n      opacity: 0;\n      transition: 600ms;\n    }\n\n    #jsenv-toolbar-trigger[data-expanded] #jsenv-toolbar-trigger-icon {\n      opacity: 1;\n    }\n  </style>\n</div>");
        var toolbarTrigger = div.firstElementChild;
        iframe.parentNode.appendChild(toolbarTrigger);
        var timer;

        toolbarTrigger.onmouseenter = function () {
          toolbarTrigger.setAttribute("data-animate", "");
          timer = setTimeout(expandToolbarTrigger, 500);
        };

        toolbarTrigger.onmouseleave = function () {
          clearTimeout(timer);
          collapseToolbarTrigger();
        };

        toolbarTrigger.onfocus = function () {
          toolbarTrigger.removeAttribute("data-animate");
          expandToolbarTrigger();
        };

        toolbarTrigger.onblur = function () {
          toolbarTrigger.removeAttribute("data-animate");
          clearTimeout(timer);
          collapseToolbarTrigger();
        };

        toolbarTrigger.onclick = function () {
          sendCommandToToolbar(iframe, "showToolbar");
        };

        var showToolbarTrigger = function showToolbarTrigger() {
          toolbarTrigger.style.display = "block";
        };

        var hideToolbarTrigger = function hideToolbarTrigger() {
          toolbarTrigger.style.display = "none";
        };

        var expandToolbarTrigger = function expandToolbarTrigger() {
          toolbarTrigger.setAttribute("data-expanded", "");
        };

        var collapseToolbarTrigger = function collapseToolbarTrigger() {
          toolbarTrigger.removeAttribute("data-expanded", "");
        };

        hideToolbarTrigger();
        addToolbarEventCallback(iframe, "toolbar-visibility-change", function (visible) {
          if (visible) {
            hideToolbarTrigger();
          } else {
            showToolbarTrigger();
          }
        });
        addToolbarEventCallback(iframe, "toolbar_ready", function () {
          sendCommandToToolbar(iframe, "renderToolbar");
        });
        return iframe;
      });
    });
  });

  var addToolbarEventCallback = function addToolbarEventCallback(iframe, eventName, callback) {
    var messageEventCallback = function messageEventCallback(messageEvent) {
      var data = messageEvent.data;

      if (_typeof(data) !== "object") {
        return;
      }

      var __jsenv__ = data.__jsenv__;

      if (!__jsenv__) {
        return;
      }

      if (__jsenv__.event !== eventName) {
        return;
      }

      callback(__jsenv__.data);
    };

    window.addEventListener("message", messageEventCallback, false);
    return function () {
      window.removeEventListener("message", messageEventCallback, false);
    };
  };

  var sendCommandToToolbar = function sendCommandToToolbar(iframe, command) {
    for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
      args[_key - 2] = arguments[_key];
    }

    iframe.contentWindow.postMessage({
      __jsenv__: {
        command: command,
        args: args
      }
    }, window.origin);
  };

  var getToolbarPlaceholder = function getToolbarPlaceholder() {
    var placeholder = queryPlaceholder();

    if (placeholder) {
      if (document.body.contains(placeholder)) {
        return placeholder;
      } // otherwise iframe would not be visible because in <head>


      console.warn("element with [data-jsenv-toolbar-placeholder] must be inside document.body");
      return createTooolbarPlaceholder();
    }

    return createTooolbarPlaceholder();
  };

  var queryPlaceholder = function queryPlaceholder() {
    return document.querySelector("[data-jsenv-toolbar-placeholder]");
  };

  var createTooolbarPlaceholder = function createTooolbarPlaceholder() {
    var placeholder = document.createElement("span");
    document.body.appendChild(placeholder);
    return placeholder;
  };

  var iframeToLoadedPromise = function iframeToLoadedPromise(iframe) {
    return new Promise(function (resolve) {
      var onload = function onload() {
        iframe.removeEventListener("load", onload, true);
        resolve();
      };

      iframe.addEventListener("load", onload, true);
    });
  };

  if (document.readyState === "complete") {
    injectToolbar();
  } else {
    window.addEventListener("load", injectToolbar);
  }

})();

//# sourceMappingURL=toolbar_injector_3bc47135.js.map