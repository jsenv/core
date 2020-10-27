(function () {
  'use strict';

  var nativeTypeOf = function nativeTypeOf(obj) {
    return typeof obj;
  };

  var customTypeOf = function customTypeOf(obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  };

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? nativeTypeOf : customTypeOf;

  // eslint-disable-next-line import/no-unresolved

  var getCurrentScriptSrc = function getCurrentScriptSrc() {
    var _document = document,
        currentScript = _document.currentScript;
    if (currentScript) return currentScript.src; // https://github.com/amiller-gh/currentScript-polyfill

    var scripts = Array.prototype.slice.call(document.getElementsByTagName("script"));
    var readyScript = scripts.find(function (script) {
      return script.readyState === "interactive";
    });
    if (readyScript) return readyScript;

    try {
      throw new Error();
    } catch (err) {
      // Find the second match for the "at" string to get file src url from stack.
      // Specifically works with the format of stack traces in IE.
      var stackDetails = /.*at [^(]*\((.*):(.+):(.+)\)$/gi.exec(err.stack);
      var scriptLocation = (stackDetails || [false])[1];
      var line = (stackDetails || [false])[2];
      var currentLocation = document.location.href.replace(document.location.hash, "");

      if (scriptLocation === currentLocation) {
        var source = document.documentElement.outerHTML;
        var codeRegExp = new RegExp("(?:[^\\n]+?\\n){0,".concat(line - 2, "}[^<]*<script>([\\d\\D]*?)<\\/script>[\\d\\D]*"), "i");
        var code = source.replace(codeRegExp, "$1").trim();
        return scripts.find(function (script) {
          return script.innerHTML && script.innerHTML.trim() === code;
        });
      }

      return scripts.find(function (script) {
        return script.src === scriptLocation;
      });
    }
  };

  var url = getCurrentScriptSrc();

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

  /*
  We must connect to livereload server asap so that if a file is modified
  while page is loading we are notified of it.

  Otherwise it's possible that a file is loaded and used by browser then its modified before
  livereload connection is established.

  When toolbar is loaded it will open an other connection to server sent events and close this one.
  */

  function _await(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  var connectLivereload = function connectLivereload() {
    var _window = window,
        EventSource = _window.EventSource;

    if (typeof EventSource !== "function") {
      return function () {};
    }

    var getLivereloadPreference = function getLivereloadPreference() {
      return localStorage.hasOwnProperty("livereload") ? JSON.parse(localStorage.getItem("livereload")) : true;
    };

    var url = document.location.href;
    var isOpen = false;
    var lastEventId;
    var latestChangeMap = {};
    var events = {
      "file-modified": function fileModified(_ref) {
        var data = _ref.data;
        latestChangeMap[data] = "modified";

        if (getLivereloadPreference()) {
          window.location.reload(true);
        }
      },
      "file-removed": function fileRemoved(_ref2) {
        var data = _ref2.data;
        latestChangeMap[data] = "removed";

        if (getLivereloadPreference()) {
          window.location.reload(true);
        }
      },
      "file-added": function fileAdded(_ref3) {
        var data = _ref3.data;
        latestChangeMap[data] = "added";

        if (getLivereloadPreference()) {
          window.location.reload(true);
        }
      }
    };
    var eventSourceOrigin = new URL(url).origin;
    var eventSource = new EventSource(url, {
      withCredentials: true
    });

    var disconnect = function disconnect() {
      eventSource.close();
    };

    eventSource.onopen = function () {
      isOpen = true;
    };

    eventSource.onerror = function (errorEvent) {
      if (errorEvent.target.readyState === EventSource.CLOSED) {
        isOpen = false;
      }
    };

    Object.keys(events).forEach(function (eventName) {
      eventSource.addEventListener(eventName, function (e) {
        if (e.origin === eventSourceOrigin) {
          if (e.lastEventId) {
            lastEventId = e.lastEventId;
          }

          events[eventName](e);
        }
      });
    });
    return function () {
      return {
        isOpen: isOpen,
        latestChangeMap: latestChangeMap,
        lastEventId: lastEventId,
        disconnect: disconnect
      };
    };
  }; // eslint-disable-next-line camelcase


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

  window.__jsenv_eventsource__ = connectLivereload();

  var injectToolbar = _async(function () {
    var placeholder = getToolbarPlaceholder();
    var iframe = document.createElement("iframe");
    setAttributes(iframe, {
      tabindex: -1,
      // sandbox: "allow-forms allow-modals allow-pointer-lock allow-popups allow-presentation allow-same-origin allow-scripts allow-top-navigation-by-user-activation",
      // allow: "accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; microphone; midi; payment; vr",
      allowtransparency: true
    });
    setStyles(iframe, {
      position: "fixed",
      zIndex: 1000,
      bottom: 0,
      left: 0,
      width: "100%",
      height: 0,

      /* ensure toolbar children are not focusable when hidden */
      visibility: "hidden",
      border: "none"
    });
    var iframeLoadedPromise = iframeToLoadedPromise(iframe); // set iframe src BEFORE putting it into the DOM (prevent firefox adding an history entry)

    iframe.setAttribute("src", new URL("./internal/toolbar/toolbar.html", url));
    placeholder.parentNode.replaceChild(iframe, placeholder);
    return _await(iframeLoadedPromise, function () {
      iframe.removeAttribute("tabindex");

      var listenToolbarIframeEvent = function listenToolbarIframeEvent(event, fn) {
        window.addEventListener("message", function (messageEvent) {
          var data = messageEvent.data;
          if (_typeof(data) !== "object") return;
          var jsenv = data.jsenv;
          if (!jsenv) return;
          var type = data.type;
          if (type !== event) return;
          fn(data.value);
        }, false);
      };

      listenToolbarIframeEvent("toolbar-visibility-change", function (visible) {
        if (visible) {
          hideToolbarTrigger();
        } else {
          showToolbarTrigger();
        }
      });
      var div = document.createElement("div");
      var jsenvLogoSvgSrc = new URL("./internal/toolbar/jsenv-logo.svg", url);
      div.innerHTML = "\n<div id=\"jsenv-toolbar-trigger\">\n  <svg id=\"jsenv-toolbar-trigger-icon\">\n    <use xlink:href=\"".concat(jsenvLogoSvgSrc, "#jsenv-logo\"></use>\n  </svg>\n  <style>\n    #jsenv-toolbar-trigger {\n      display: block;\n      overflow: hidden;\n      position: fixed;\n      z-index: 1000;\n      bottom: -32px;\n      right: 20px;\n      height: 40px;\n      width: 40px;\n      padding: 0;\n      border-radius: 5px 5px 0 0;\n      border: 1px solid rgba(0, 0, 0, 0.33);\n      border-bottom: none;\n      box-shadow: 0px 0px 6px 2px rgba(0, 0, 0, 0.46);\n      background: transparent;\n      text-align: center;\n      transition: 600ms;\n    }\n\n    #jsenv-toolbar-trigger:hover {\n      cursor: pointer;\n    }\n\n    #jsenv-toolbar-trigger[data-expanded] {\n      bottom: 0;\n    }\n\n    #jsenv-toolbar-trigger-icon {\n      width: 35px;\n      height: 35px;\n      opacity: 0;\n      transition: 600ms;\n    }\n\n    #jsenv-toolbar-trigger[data-expanded] #jsenv-toolbar-trigger-icon {\n      opacity: 1;\n    }\n  </style>\n</div>");
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
        window.__jsenv__.toolbar.show();
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
      return iframe;
    });
  });

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

}());

//# sourceMappingURL=jsenv-toolbar-injector.js.map