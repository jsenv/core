(function () {
  'use strict';

  var nativeTypeOf = function nativeTypeOf(obj) {
    return typeof obj;
  };

  var customTypeOf = function customTypeOf(obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  };

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? nativeTypeOf : customTypeOf;

  var defineProperty = (function (obj, key, value) {
    // Shortcircuit the slow defineProperty path when possible.
    // We are trying to avoid issues where setters defined on the
    // prototype cause side effects under the fast path of simple
    // assignment. By checking for existence of the property with
    // the in operator, we can optimize most of this overhead away.
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  });

  function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);

    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);

      if (enumerableOnly) {
        symbols = symbols.filter(function (sym) {
          return Object.getOwnPropertyDescriptor(object, sym).enumerable;
        });
      }

      keys.push.apply(keys, symbols);
    }

    return keys;
  }

  function _objectSpread2(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i] != null ? arguments[i] : {};

      if (i % 2) {
        ownKeys(Object(source), true).forEach(function (key) {
          defineProperty(target, key, source[key]);
        });
      } else if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
      } else {
        ownKeys(Object(source)).forEach(function (key) {
          Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
      }
    }

    return target;
  }

  var objectWithoutPropertiesLoose = (function (source, excluded) {
    if (source === null) return {};
    var target = {};
    var sourceKeys = Object.keys(source);
    var key;
    var i;

    for (i = 0; i < sourceKeys.length; i++) {
      key = sourceKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      target[key] = source[key];
    }

    return target;
  });

  var _objectWithoutProperties = (function (source, excluded) {
    if (source === null) return {};
    var target = objectWithoutPropertiesLoose(source, excluded);
    var key;
    var i;

    if (Object.getOwnPropertySymbols) {
      var sourceSymbolKeys = Object.getOwnPropertySymbols(source);

      for (i = 0; i < sourceSymbolKeys.length; i++) {
        key = sourceSymbolKeys[i];
        if (excluded.indexOf(key) >= 0) continue;
        if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
        target[key] = source[key];
      }
    }

    return target;
  });

  /* eslint-env browser */
  function _await$4(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  function _async$4(f) {
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

  function _call$1(body, then, direct) {
    if (direct) {
      return then ? then(body()) : body();
    }

    try {
      var result = Promise.resolve(body());
      return then ? result.then(then) : result;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  var fetchUsingXHR = _async$4(function (url) {
    var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        signal = _ref.signal,
        _ref$method = _ref.method,
        method = _ref$method === void 0 ? "GET" : _ref$method,
        _ref$credentials = _ref.credentials,
        credentials = _ref$credentials === void 0 ? "same-origin" : _ref$credentials,
        _ref$headers = _ref.headers,
        headers = _ref$headers === void 0 ? {} : _ref$headers,
        _ref$body = _ref.body,
        body = _ref$body === void 0 ? null : _ref$body;

    var headersPromise = createPromiseAndHooks();
    var bodyPromise = createPromiseAndHooks();
    var xhr = new XMLHttpRequest();

    var failure = function failure(error) {
      // if it was already resolved, we must reject the body promise
      if (headersPromise.settled) {
        bodyPromise.reject(error);
      } else {
        headersPromise.reject(error);
      }
    };

    var cleanup = function cleanup() {
      xhr.ontimeout = null;
      xhr.onerror = null;
      xhr.onload = null;
      xhr.onreadystatechange = null;
    };

    xhr.ontimeout = function () {
      cleanup();
      failure(new Error("xhr request timeout on ".concat(url, ".")));
    };

    xhr.onerror = function (error) {
      cleanup(); // unfortunately with have no clue why it fails
      // might be cors for instance

      failure(createRequestError(error, {
        url: url
      }));
    };

    xhr.onload = function () {
      cleanup();
      bodyPromise.resolve();
    };

    signal.addEventListener("abort", function () {
      xhr.abort();
      var abortError = new Error("aborted");
      abortError.name = "AbortError";
      failure(abortError);
    });

    xhr.onreadystatechange = function () {
      // https://developer.mozilla.org/fr/docs/Web/API/XMLHttpRequest/readyState
      var readyState = xhr.readyState;

      if (readyState === 2) {
        headersPromise.resolve();
      } else if (readyState === 4) {
        cleanup();
        bodyPromise.resolve();
      }
    };

    xhr.open(method, url, true);
    Object.keys(headers).forEach(function (key) {
      xhr.setRequestHeader(key, headers[key]);
    });
    xhr.withCredentials = computeWithCredentials({
      credentials: credentials,
      url: url
    });

    if ("responseType" in xhr && hasBlob) {
      xhr.responseType = "blob";
    }

    xhr.send(body);
    return _await$4(headersPromise, function () {
      // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/responseURL
      var responseUrl = "responseURL" in xhr ? xhr.responseURL : headers["x-request-url"];
      var responseStatus = xhr.status;
      var responseStatusText = xhr.statusText;
      var responseHeaders = getHeadersFromXHR(xhr);

      var readBody = function readBody() {
        return _await$4(bodyPromise, function () {
          var status = xhr.status; // in Chrome on file:/// URLs, status is 0

          if (status === 0) {
            responseStatus = 200;
          }

          var body = "response" in xhr ? xhr.response : xhr.responseText;
          return {
            responseBody: body,
            responseBodyType: detectBodyType(body)
          };
        });
      };

      var text = function text() {
        return _call$1(readBody, function (_ref2) {
          var responseBody = _ref2.responseBody,
              responseBodyType = _ref2.responseBodyType;

          if (responseBodyType === "blob") {
            return blobToText(responseBody);
          }

          if (responseBodyType === "formData") {
            throw new Error("could not read FormData body as text");
          }

          return responseBodyType === "dataView" ? arrayBufferToText(responseBody.buffer) : responseBodyType === "arrayBuffer" ? arrayBufferToText(responseBody) : String(responseBody);
        });
      };

      var json = function json() {
        return _call$1(text, JSON.parse);
      };

      var blob = _async$4(function () {
        if (!hasBlob) {
          throw new Error("blob not supported");
        }

        return _call$1(readBody, function (_ref3) {
          var responseBody = _ref3.responseBody,
              responseBodyType = _ref3.responseBodyType;

          if (responseBodyType === "blob") {
            return responseBody;
          }

          if (responseBodyType === "dataView") {
            return new Blob([cloneBuffer(responseBody.buffer)]);
          }

          if (responseBodyType === "arrayBuffer") {
            return new Blob([cloneBuffer(responseBody)]);
          }

          if (responseBodyType === "formData") {
            throw new Error("could not read FormData body as blob");
          }

          return new Blob([String(responseBody)]);
        });
      });

      var arrayBuffer = function arrayBuffer() {
        return _call$1(readBody, function (_ref4) {
          var responseBody = _ref4.responseBody,
              responseBodyType = _ref4.responseBodyType;
          return responseBodyType === "arrayBuffer" ? cloneBuffer(responseBody) : _call$1(blob, blobToArrayBuffer);
        });
      };

      var formData = _async$4(function () {
        if (!hasFormData) {
          throw new Error("formData not supported");
        }

        return _call$1(text, textToFormData);
      });

      return {
        url: responseUrl,
        status: responseStatus,
        statusText: responseStatusText,
        headers: responseHeaders,
        text: text,
        json: json,
        blob: blob,
        arrayBuffer: arrayBuffer,
        formData: formData
      };
    });
  });

  var canUseBlob = function canUseBlob() {
    if (typeof window.FileReader !== "function") return false;
    if (typeof window.Blob !== "function") return false;

    try {
      // eslint-disable-next-line no-new
      new Blob();
      return true;
    } catch (e) {
      return false;
    }
  };

  var hasBlob = canUseBlob();
  var hasFormData = typeof window.FormData === "function";
  var hasArrayBuffer = typeof window.ArrayBuffer === "function";
  var hasSearchParams = typeof window.URLSearchParams === "function";

  var createRequestError = function createRequestError(error, _ref5) {
    var url = _ref5.url;
    return new Error("error during xhr request on ".concat(url, ".\n--- error stack ---\n").concat(error.stack));
  };

  var createPromiseAndHooks = function createPromiseAndHooks() {
    var resolve;
    var reject;
    var promise = new Promise(function (res, rej) {
      resolve = function resolve(value) {
        promise.settled = true;
        res(value);
      };

      reject = function reject(value) {
        promise.settled = true;
        rej(value);
      };
    });
    promise.resolve = resolve;
    promise.reject = reject;
    return promise;
  }; // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch


  var computeWithCredentials = function computeWithCredentials(_ref6) {
    var credentials = _ref6.credentials,
        url = _ref6.url;

    if (credentials === "same-origin") {
      return originSameAsGlobalOrigin(url);
    }

    return credentials === "include";
  };

  var originSameAsGlobalOrigin = function originSameAsGlobalOrigin(url) {
    // if we cannot read globalOrigin from window.location.origin, let's consider it's ok
    if ((typeof window === "undefined" ? "undefined" : _typeof(window)) !== "object") return true;
    if (_typeof(window.location) !== "object") return true;
    var globalOrigin = window.location.origin;
    if (globalOrigin === "null") return true;
    return hrefToOrigin(url) === globalOrigin;
  };

  var detectBodyType = function detectBodyType(body) {
    if (!body) {
      return "";
    }

    if (typeof body === "string") {
      return "text";
    }

    if (hasBlob && Blob.prototype.isPrototypeOf(body)) {
      return "blob";
    }

    if (hasFormData && FormData.prototype.isPrototypeOf(body)) {
      return "formData";
    }

    if (hasArrayBuffer) {
      if (hasBlob && isDataView(body)) {
        return "dataView";
      }

      if (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body)) {
        return "arrayBuffer";
      }
    }

    if (hasSearchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
      return "searchParams";
    }

    return "";
  }; // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/getAllResponseHeaders#Example


  var getHeadersFromXHR = function getHeadersFromXHR(xhr) {
    var headerMap = {};
    var headersString = xhr.getAllResponseHeaders();
    if (headersString === "") return headerMap;
    var lines = headersString.trim().split(/[\r\n]+/);
    lines.forEach(function (line) {
      var parts = line.split(": ");
      var name = parts.shift();
      var value = parts.join(": ");
      headerMap[name.toLowerCase()] = value;
    });
    return headerMap;
  };

  var hrefToOrigin = function hrefToOrigin(href) {
    var scheme = hrefToScheme(href);

    if (scheme === "file") {
      return "file://";
    }

    if (scheme === "http" || scheme === "https") {
      var secondProtocolSlashIndex = scheme.length + "://".length;
      var pathnameSlashIndex = href.indexOf("/", secondProtocolSlashIndex);
      if (pathnameSlashIndex === -1) return href;
      return href.slice(0, pathnameSlashIndex);
    }

    return href.slice(0, scheme.length + 1);
  };

  var hrefToScheme = function hrefToScheme(href) {
    var colonIndex = href.indexOf(":");
    if (colonIndex === -1) return "";
    return href.slice(0, colonIndex);
  };

  var isDataView = function isDataView(obj) {
    return obj && DataView.prototype.isPrototypeOf(obj);
  };

  var isArrayBufferView = ArrayBuffer.isView || function () {
    var viewClasses = ["[object Int8Array]", "[object Uint8Array]", "[object Uint8ClampedArray]", "[object Int16Array]", "[object Uint16Array]", "[object Int32Array]", "[object Uint32Array]", "[object Float32Array]", "[object Float64Array]"];
    return function (value) {
      return value && viewClasses.includes(Object.prototype.toString.call(value));
    };
  }();

  var textToFormData = function textToFormData(text) {
    var form = new FormData();
    text.trim().split("&").forEach(function (bytes) {
      if (bytes) {
        var split = bytes.split("=");
        var name = split.shift().replace(/\+/g, " ");
        var value = split.join("=").replace(/\+/g, " ");
        form.append(decodeURIComponent(name), decodeURIComponent(value));
      }
    });
    return form;
  };

  var blobToArrayBuffer = _async$4(function (blob) {
    var reader = new FileReader();
    var promise = fileReaderReady(reader);
    reader.readAsArrayBuffer(blob);
    return promise;
  });

  var blobToText = function blobToText(blob) {
    var reader = new FileReader();
    var promise = fileReaderReady(reader);
    reader.readAsText(blob);
    return promise;
  };

  var arrayBufferToText = function arrayBufferToText(arrayBuffer) {
    var view = new Uint8Array(arrayBuffer);
    var chars = new Array(view.length);
    var i = 0;

    while (i < view.length) {
      chars[i] = String.fromCharCode(view[i]);
      i++;
    }

    return chars.join("");
  };

  var fileReaderReady = function fileReaderReady(reader) {
    return new Promise(function (resolve, reject) {
      reader.onload = function () {
        resolve(reader.result);
      };

      reader.onerror = function () {
        reject(reader.error);
      };
    });
  };

  var cloneBuffer = function cloneBuffer(buffer) {
    if (buffer.slice) {
      return buffer.slice(0);
    }

    var view = new Uint8Array(buffer.byteLength);
    view.set(new Uint8Array(buffer));
    return view.buffer;
  };

  var _excluded = ["mode"];

  function _await$3(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  function _async$3(f) {
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

  var fetchNative = _async$3(function (url) {
    var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    var _ref$mode = _ref.mode,
        mode = _ref$mode === void 0 ? "cors" : _ref$mode,
        options = _objectWithoutProperties(_ref, _excluded);

    return _await$3(window.fetch(url, _objectSpread2({
      mode: mode
    }, options)), function (response) {
      return {
        url: response.url,
        status: response.status,
        statusText: "",
        headers: responseToHeaders(response),
        text: function text() {
          return response.text();
        },
        json: function json() {
          return response.json();
        },
        blob: function blob() {
          return response.blob();
        },
        arrayBuffer: function arrayBuffer() {
          return response.arrayBuffer();
        },
        formData: function formData() {
          return response.formData();
        }
      };
    });
  });

  var responseToHeaders = function responseToHeaders(response) {
    var headers = {};
    response.headers.forEach(function (value, name) {
      headers[name] = value;
    });
    return headers;
  };

  var fetchUrl = typeof window.fetch === "function" && typeof window.AbortController === "function" ? fetchNative : fetchUsingXHR;

  function _await$2(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  function _async$2(f) {
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

  var fetchJson = _async$2(function (url) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    return _await$2(fetchUrl(url, options), function (response) {
      return _await$2(response.json());
    });
  });

  function _await$1(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  function _catch(body, recover) {
    try {
      var result = body();
    } catch (e) {
      return recover(e);
    }

    if (result && result.then) {
      return result.then(void 0, recover);
    }

    return result;
  }

  function _async$1(f) {
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

  var fetchExploringJson = _async$1(function () {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        signal = _ref.signal;

    return _catch(function () {
      return _await$1(fetchJson("/.jsenv/exploring.json", {
        signal: signal
      }));
    }, function (e) {
      if (signal && signal.aborted && e.name === "AbortError") {
        throw e;
      }

      throw new Error("Cannot communicate with exploring server due to a network error\n--- error stack ---\n".concat(e.stack));
    });
  });

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

  var TOOLBAR_BUILD_RELATIVE_URL = "dist/toolbar/toolbar_f7b8a263.html";

  function _call(body, then, direct) {
    if (direct) {
      return then ? then(body()) : body();
    }

    try {
      var result = Promise.resolve(body());
      return then ? result.then(then) : result;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  var jsenvLogoSvgUrl = new URL("assets/jsenv-logo_188b9ca6.svg", document.currentScript && document.currentScript.src || document.baseURI);

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

  var injectToolbar = _async(function () {
    return _await(new Promise(function (resolve) {
      if (window.requestIdleCallback) {
        window.requestIdleCallback(resolve);
      } else {
        window.requestAnimationFrame(resolve);
      }
    }), function () {
      return _call(fetchExploringJson, function (_ref) {
        var jsenvDirectoryRelativeUrl = _ref.jsenvDirectoryRelativeUrl;
        var jsenvDirectoryServerUrl = resolveUrl(jsenvDirectoryRelativeUrl, document.location.origin);
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
        var jsenvToolbarHtmlServerUrl = resolveUrl(TOOLBAR_BUILD_RELATIVE_URL, jsenvDirectoryServerUrl); // set iframe src BEFORE putting it into the DOM (prevent firefox adding an history entry)

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

  var resolveUrl = function resolveUrl(url, baseUrl) {
    return String(new URL(url, baseUrl));
  };

  if (document.readyState === "complete") {
    injectToolbar();
  } else {
    window.addEventListener("load", injectToolbar);
  }

})();

//# sourceMappingURL=toolbar_injector_49e4756e.js.map