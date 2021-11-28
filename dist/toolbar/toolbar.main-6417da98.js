System.register([], (function (exports, module) {
  'use strict';
  return {
    execute: (function () {

      var urlIsInsideOf = function urlIsInsideOf(url, otherUrl) {
        var urlObject = new URL(url);
        var otherUrlObject = new URL(otherUrl);

        if (urlObject.origin !== otherUrlObject.origin) {
          return false;
        }

        var urlPathname = urlObject.pathname;
        var otherUrlPathname = otherUrlObject.pathname;

        if (urlPathname === otherUrlPathname) {
          return false;
        }

        var isInside = urlPathname.startsWith(otherUrlPathname);
        return isInside;
      };

      var getCommonPathname = function getCommonPathname(pathname, otherPathname) {
        var firstDifferentCharacterIndex = findFirstDifferentCharacterIndex(pathname, otherPathname); // pathname and otherpathname are exactly the same

        if (firstDifferentCharacterIndex === -1) {
          return pathname;
        }

        var commonString = pathname.slice(0, firstDifferentCharacterIndex + 1); // the first different char is at firstDifferentCharacterIndex

        if (pathname.charAt(firstDifferentCharacterIndex) === "/") {
          return commonString;
        }

        if (otherPathname.charAt(firstDifferentCharacterIndex) === "/") {
          return commonString;
        }

        var firstDifferentSlashIndex = commonString.lastIndexOf("/");
        return pathname.slice(0, firstDifferentSlashIndex + 1);
      };

      var findFirstDifferentCharacterIndex = function findFirstDifferentCharacterIndex(string, otherString) {
        var maxCommonLength = Math.min(string.length, otherString.length);
        var i = 0;

        while (i < maxCommonLength) {
          var char = string.charAt(i);
          var otherChar = otherString.charAt(i);

          if (char !== otherChar) {
            return i;
          }

          i++;
        }

        if (string.length === otherString.length) {
          return -1;
        } // they differ at maxCommonLength


        return maxCommonLength;
      };

      var pathnameToParentPathname = function pathnameToParentPathname(pathname) {
        var slashLastIndex = pathname.lastIndexOf("/");

        if (slashLastIndex === -1) {
          return "/";
        }

        return pathname.slice(0, slashLastIndex + 1);
      };

      var urlToRelativeUrl = function urlToRelativeUrl(url, baseUrl) {
        var urlObject = new URL(url);
        var baseUrlObject = new URL(baseUrl);

        if (urlObject.protocol !== baseUrlObject.protocol) {
          var urlAsString = String(url);
          return urlAsString;
        }

        if (urlObject.username !== baseUrlObject.username || urlObject.password !== baseUrlObject.password || urlObject.host !== baseUrlObject.host) {
          var afterUrlScheme = String(url).slice(urlObject.protocol.length);
          return afterUrlScheme;
        }

        var pathname = urlObject.pathname,
            hash = urlObject.hash,
            search = urlObject.search;

        if (pathname === "/") {
          var baseUrlRessourceWithoutLeadingSlash = baseUrlObject.pathname.slice(1);
          return baseUrlRessourceWithoutLeadingSlash;
        }

        var basePathname = baseUrlObject.pathname;
        var commonPathname = getCommonPathname(pathname, basePathname);

        if (!commonPathname) {
          var _urlAsString = String(url);

          return _urlAsString;
        }

        var specificPathname = pathname.slice(commonPathname.length);
        var baseSpecificPathname = basePathname.slice(commonPathname.length);

        if (baseSpecificPathname.includes("/")) {
          var baseSpecificParentPathname = pathnameToParentPathname(baseSpecificPathname);
          var relativeDirectoriesNotation = baseSpecificParentPathname.replace(/.*?\//g, "../");

          var _relativeUrl = "".concat(relativeDirectoriesNotation).concat(specificPathname).concat(search).concat(hash);

          return _relativeUrl;
        }

        var relativeUrl = "".concat(specificPathname).concat(search).concat(hash);
        return relativeUrl;
      };

      var _defineProperty = (function (obj, key, value) {
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

      var createDetailedMessage = function createDetailedMessage(message) {
        var details = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        var string = "".concat(message);
        Object.keys(details).forEach(function (key) {
          var value = details[key];
          string += "\n--- ".concat(key, " ---\n").concat(Array.isArray(value) ? value.join("\n") : value);
        });
        return string;
      };

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
              _defineProperty(target, key, source[key]);
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

      var nativeTypeOf = function nativeTypeOf(obj) {
        return typeof obj;
      };

      var customTypeOf = function customTypeOf(obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
      };

      var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? nativeTypeOf : customTypeOf;

      function _await$5(value, then, direct) {
        if (direct) {
          return then ? then(value) : value;
        }

        if (!value || !value.then) {
          value = Promise.resolve(value);
        }

        return then ? value.then(then) : value;
      }

      function _async$6(f) {
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

      function _call$3(body, then, direct) {
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

      var fetchUsingXHR = _async$6(function (url) {
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
        return _await$5(headersPromise, function () {
          // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/responseURL
          var responseUrl = "responseURL" in xhr ? xhr.responseURL : headers["x-request-url"];
          var responseStatus = xhr.status;
          var responseStatusText = xhr.statusText;
          var responseHeaders = getHeadersFromXHR(xhr);

          var readBody = function readBody() {
            return _await$5(bodyPromise, function () {
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
            return _call$3(readBody, function (_ref2) {
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
            return _call$3(text, JSON.parse);
          };

          var blob = _async$6(function () {
            if (!hasBlob) {
              throw new Error("blob not supported");
            }

            return _call$3(readBody, function (_ref3) {
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
            return _call$3(readBody, function (_ref4) {
              var responseBody = _ref4.responseBody,
                  responseBodyType = _ref4.responseBodyType;
              return responseBodyType === "arrayBuffer" ? cloneBuffer(responseBody) : _call$3(blob, blobToArrayBuffer);
            });
          };

          var formData = _async$6(function () {
            if (!hasFormData) {
              throw new Error("formData not supported");
            }

            return _call$3(text, textToFormData);
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
        return new Error(createDetailedMessage("error during xhr request on ".concat(url, "."), _defineProperty({}, "error stack", error.stack)));
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

      var blobToArrayBuffer = _async$6(function (blob) {
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

      var _excluded$1 = ["mode"];

      function _await$4(value, then, direct) {
        if (direct) {
          return then ? then(value) : value;
        }

        if (!value || !value.then) {
          value = Promise.resolve(value);
        }

        return then ? value.then(then) : value;
      }

      var fetchNative = _async$5(function (url) {
        var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        var _ref$mode = _ref.mode,
            mode = _ref$mode === void 0 ? "cors" : _ref$mode,
            options = _objectWithoutProperties(_ref, _excluded$1);

        return _await$4(window.fetch(url, _objectSpread2({
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

      function _async$5(f) {
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

      var responseToHeaders = function responseToHeaders(response) {
        var headers = {};
        response.headers.forEach(function (value, name) {
          headers[name] = value;
        });
        return headers;
      };

      var fetchUrl = typeof window.fetch === "function" && typeof window.AbortController === "function" ? fetchNative : fetchUsingXHR;

      function _await$3(value, then, direct) {
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

      var fetchJson = _async$4(function (url) {
        var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        return _await$3(fetchUrl(url, options), function (response) {
          return _await$3(response.json());
        });
      });

      function _await$2(value, then, direct) {
        if (direct) {
          return then ? then(value) : value;
        }

        if (!value || !value.then) {
          value = Promise.resolve(value);
        }

        return then ? value.then(then) : value;
      }

      function _catch$1(body, recover) {
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

      var fetchExploringJson = _async$3(function () {
        var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
            signal = _ref.signal;

        return _catch$1(function () {
          return _await$2(fetchJson("/.jsenv/exploring.json", {
            signal: signal
          }));
        }, function (e) {
          if (signal && signal.aborted && e.name === "AbortError") {
            throw e;
          }

          throw new Error(createDetailedMessage("Cannot communicate with exploring server due to a network error", _defineProperty({}, "error stack", e.stack)));
        });
      });

      var updateIframeOverflowOnParentWindow = function updateIframeOverflowOnParentWindow() {
        var aTooltipIsOpened = document.querySelector("[data-tooltip-visible]") || document.querySelector("[data-tooltip-auto-visible]");
        var settingsAreOpened = document.querySelector("#settings[data-active]");

        if (aTooltipIsOpened || settingsAreOpened) {
          enableIframeOverflowOnParentWindow();
        } else {
          disableIframeOverflowOnParentWindow();
        }
      };
      var iframeOverflowEnabled = false;

      var enableIframeOverflowOnParentWindow = function enableIframeOverflowOnParentWindow() {
        if (iframeOverflowEnabled) return;
        iframeOverflowEnabled = true;
        var iframe = getToolbarIframe();
        var transitionDuration = iframe.style.transitionDuration;
        setStyles(iframe, {
          "height": "100%",
          "transition-duration": "0ms"
        });

        if (transitionDuration) {
          setTimeout(function () {
            setStyles(iframe, {
              "transition-duration": transitionDuration
            });
          });
        }
      };

      var disableIframeOverflowOnParentWindow = function disableIframeOverflowOnParentWindow() {
        if (!iframeOverflowEnabled) return;
        iframeOverflowEnabled = false;
        var iframe = getToolbarIframe();
        var transitionDuration = iframe.style.transitionDuration;
        setStyles(iframe, {
          "height": "40px",
          "transition-duration": "0ms"
        });

        if (transitionDuration) {
          setTimeout(function () {
            setStyles(iframe, {
              "transition-duration": transitionDuration
            });
          });
        }
      };

      var getToolbarIframe = function getToolbarIframe() {
        var iframes = Array.from(window.parent.document.querySelectorAll("iframe"));
        return iframes.find(function (iframe) {
          return iframe.contentWindow === window;
        });
      };
      var forceHideElement = function forceHideElement(element) {
        element.setAttribute("data-force-hide", "");
      };
      var removeForceHideElement = function removeForceHideElement(element) {
        element.removeAttribute("data-force-hide");
      };
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
      var toolbarSectionIsActive = function toolbarSectionIsActive(element) {
        return element.hasAttribute("data-active");
      };
      var activateToolbarSection = function activateToolbarSection(element) {
        element.setAttribute("data-active", "");
      };
      var deactivateToolbarSection = function deactivateToolbarSection(element) {
        element.removeAttribute("data-active");
      };

      var startJavaScriptAnimation = function startJavaScriptAnimation(_ref6) {
        var _ref6$duration = _ref6.duration,
            duration = _ref6$duration === void 0 ? 300 : _ref6$duration,
            _ref6$timingFunction = _ref6.timingFunction,
            timingFunction = _ref6$timingFunction === void 0 ? function (t) {
          return t;
        } : _ref6$timingFunction,
            _ref6$onProgress = _ref6.onProgress,
            onProgress = _ref6$onProgress === void 0 ? function () {} : _ref6$onProgress,
            _ref6$onCancel = _ref6.onCancel,
            onCancel = _ref6$onCancel === void 0 ? function () {} : _ref6$onCancel,
            _ref6$onComplete = _ref6.onComplete,
            onComplete = _ref6$onComplete === void 0 ? function () {} : _ref6$onComplete;

        if (isNaN(duration)) {
          // console.warn(`duration must be a number, received ${duration}`)
          return function () {};
        }

        duration = parseInt(duration, 10);
        var startMs = performance.now();
        var currentRequestAnimationFrameId;
        var done = false;
        var rawProgress = 0;
        var progress = 0;

        var handler = function handler() {
          currentRequestAnimationFrameId = null;
          var nowMs = performance.now();
          rawProgress = Math.min((nowMs - startMs) / duration, 1);
          progress = timingFunction(rawProgress);
          done = rawProgress === 1;
          onProgress({
            done: done,
            rawProgress: rawProgress,
            progress: progress
          });

          if (done) {
            onComplete();
          } else {
            currentRequestAnimationFrameId = window.requestAnimationFrame(handler);
          }
        };

        handler();

        var stop = function stop() {
          if (currentRequestAnimationFrameId) {
            window.cancelAnimationFrame(currentRequestAnimationFrameId);
            currentRequestAnimationFrameId = null;
          }

          if (!done) {
            done = true;
            onCancel({
              rawProgress: rawProgress,
              progress: progress
            });
          }
        };

        return stop;
      };

      // handle data-last-interaction attr on html (focusring)
      window.addEventListener("mousedown", function (mousedownEvent) {
        if (mousedownEvent.defaultPrevented) {
          return;
        }

        document.documentElement.setAttribute("data-last-interaction", "mouse");
      });
      window.addEventListener("touchstart", function (touchstartEvent) {
        if (touchstartEvent.defaultPrevented) {
          return;
        }

        document.documentElement.setAttribute("data-last-interaction", "mouse");
      });
      window.addEventListener("keydown", function (keydownEvent) {
        if (keydownEvent.defaultPrevented) {
          return;
        }

        document.documentElement.setAttribute("data-last-interaction", "keyboard");
      });

      var createPreference = function createPreference(name) {
        return {
          has: function has() {
            return localStorage.hasOwnProperty(name);
          },
          get: function get() {
            return localStorage.hasOwnProperty(name) ? JSON.parse(localStorage.getItem(name)) : undefined;
          },
          set: function set(value) {
            return localStorage.setItem(name, JSON.stringify(value));
          }
        };
      };

      var toggleTooltip = function toggleTooltip(element) {
        if (element.hasAttribute("data-tooltip-visible")) {
          hideTooltip(element);
        } else {
          showTooltip(element);
        }
      };
      var hideTooltip = function hideTooltip(element) {
        element.removeAttribute("data-tooltip-visible");
        element.removeAttribute("data-tooltip-auto-visible");
        updateIframeOverflowOnParentWindow();
      };
      var showTooltip = function showTooltip(element) {
        element.setAttribute("data-tooltip-visible", "");
        updateIframeOverflowOnParentWindow();
      };
      var autoShowTooltip = function autoShowTooltip(element) {
        element.setAttribute("data-tooltip-auto-visible", "");
        updateIframeOverflowOnParentWindow();
      };
      var removeAutoShowTooltip = function removeAutoShowTooltip(element) {
        element.removeAttribute("data-tooltip-auto-visible");
        updateIframeOverflowOnParentWindow();
      };
      var hideAllTooltip = function hideAllTooltip() {
        var elementsWithTooltip = Array.from(document.querySelectorAll("[data-tooltip-visible]"));
        elementsWithTooltip.forEach(function (elementWithTooltip) {
          hideTooltip(elementWithTooltip);
        });
      };

      var renderToolbarSettings = function renderToolbarSettings() {
        document.querySelector("#settings-button").onclick = toggleSettings;
        document.querySelector("#button-close-settings").onclick = toggleSettings;
      };

      var toggleSettings = function toggleSettings() {
        if (settingsAreVisible()) {
          hideSettings();
        } else {
          showSettings();
        }
      };

      var settingsAreVisible = function settingsAreVisible() {
        return toolbarSectionIsActive(document.querySelector("#settings"));
      };
      var hideSettings = function hideSettings() {
        deactivateToolbarSection(document.querySelector("#settings"));
        updateIframeOverflowOnParentWindow();
      };
      var showSettings = function showSettings() {
        activateToolbarSection(document.querySelector("#settings"));
        updateIframeOverflowOnParentWindow();
      };

      var _excluded = ["clickToFocus", "clickToClose"];

      function _await$1(value, then, direct) {
        if (direct) {
          return then ? then(value) : value;
        }

        if (!value || !value.then) {
          value = Promise.resolve(value);
        }

        return then ? value.then(then) : value;
      }

      function _call$2(body, then, direct) {
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

      var notificationPreference = createPreference("notification");

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

      var arrayOfOpenedNotifications = [];
      var renderToolbarNotification = function renderToolbarNotification() {
        var notifCheckbox = document.querySelector("#toggle-notifs");
        notifCheckbox.checked = getNotificationPreference();

        notifCheckbox.onchange = function () {
          setNotificationPreference(notifCheckbox.checked);

          if (notifCheckbox.checked) {
            // request permission early
            // especially useful on firefox where you can request permission
            // only inside a user generated event such as this onchange handler
            requestPermission();
          } else {
            // slice because arrayOfOpenedNotifications can be mutated while looping
            arrayOfOpenedNotifications.slice().forEach(function (notification) {
              notification.close();
            });
          }
        };
      };
      var notifyExecutionResult = function notifyExecutionResult(executedFileRelativeUrl, execution, previousExecution) {
        var notificationEnabled = getNotificationPreference();
        if (!notificationEnabled) return;
        var notificationOptions = {
          lang: "en",
          icon: getFaviconHref(),
          clickToFocus: true,
          clickToClose: true
        };

        if (execution.status === "errored") {
          if (previousExecution) {
            if (previousExecution.status === "completed") {
              notify("Broken", _objectSpread2(_objectSpread2({}, notificationOptions), {}, {
                body: "".concat(executedFileRelativeUrl, " execution now failing.")
              }));
            } else {
              notify("Still failing", _objectSpread2(_objectSpread2({}, notificationOptions), {}, {
                body: "".concat(executedFileRelativeUrl, " execution still failing.")
              }));
            }
          } else {
            notify("Failing", _objectSpread2(_objectSpread2({}, notificationOptions), {}, {
              body: "".concat(executedFileRelativeUrl, " execution failed.")
            }));
          }
        } else if (previousExecution && previousExecution.status === "errored") {
          notify("Fixed", _objectSpread2(_objectSpread2({}, notificationOptions), {}, {
            body: "".concat(executedFileRelativeUrl, " execution fixed.")
          }));
        }
      };
      var notificationAvailable = typeof window.Notification === "function";

      var getNotificationPreference = function getNotificationPreference() {
        return notificationPreference.has() ? notificationPreference.get() : true;
      };

      var setNotificationPreference = function setNotificationPreference(value) {
        return notificationPreference.set(value);
      };

      var getFaviconHref = function getFaviconHref() {
        var link = document.querySelector('link[rel="icon"]');
        return link ? link.href : undefined;
      };

      var notify = notificationAvailable ? function (title) {
        var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        var _ref$clickToFocus = _ref.clickToFocus,
            clickToFocus = _ref$clickToFocus === void 0 ? false : _ref$clickToFocus,
            _ref$clickToClose = _ref.clickToClose,
            clickToClose = _ref$clickToClose === void 0 ? false : _ref$clickToClose,
            options = _objectWithoutProperties(_ref, _excluded);

        return _call$2(requestPermission, function (permission) {
          if (permission === "granted") {
            var notification = new Notification(title, options);
            arrayOfOpenedNotifications.push(notification);

            notification.onclick = function () {
              // but if the user navigated inbetween
              // focusing window will show something else
              // in that case it could be great to do something
              // maybe like showing a message saying this execution
              // is no longer visible
              // we could also navigauate to this file execution but
              // there is no guarantee re-executing the file would give same output
              // and it would also trigger an other notification
              if (clickToFocus) window.focus();
              if (clickToClose) notification.close();
            };

            notification.onclose = function () {
              var index = arrayOfOpenedNotifications.indexOf(notification);

              if (index > -1) {
                arrayOfOpenedNotifications.splice(index, 1);
              }
            };

            return notification;
          }

          return null;
        });
      } : function () {};
      var permissionPromise;
      var requestPermission = notificationAvailable ? _async$2(function () {
        if (permissionPromise) return permissionPromise;
        permissionPromise = Notification.requestPermission();
        return _await$1(permissionPromise, function (permission) {
          permissionPromise = undefined;
          return permission;
        });
      }) : function () {
        return Promise.resolve("denied");
      };

      var DARK_THEME = "dark";
      var LIGHT_THEME = "light";
      var themePreference = createPreference("theme");
      var renderToolbarTheme = function renderToolbarTheme() {
        var theme = getThemePreference();
        var checkbox = document.querySelector("#checkbox-dark-theme");
        checkbox.checked = theme === DARK_THEME;
        setTheme(theme);

        checkbox.onchange = function () {
          if (checkbox.checked) {
            setThemePreference(DARK_THEME);
            setTheme(DARK_THEME);
          } else {
            setThemePreference(LIGHT_THEME);
            setTheme(LIGHT_THEME);
          }
        };
      };

      var getThemePreference = function getThemePreference() {
        return themePreference.has() ? themePreference.get() : DARK_THEME;
      };

      var setThemePreference = function setThemePreference(value) {
        themePreference.set(value);
        setTheme(value);
      };

      var setTheme = function setTheme(theme) {
        document.querySelector("html").setAttribute("data-theme", theme);
      };

      var animationPreference = createPreference("animation");
      var renderToolbarAnimation = function renderToolbarAnimation() {
        var animCheckbox = document.querySelector("#toggle-anims");
        animCheckbox.checked = getAnimationPreference();

        animCheckbox.onchange = function () {
          setAnimationPreference(animCheckbox.checked);
          onPreferenceChange(animCheckbox.checked);
        };

        onPreferenceChange(); // enable toolbar transition only after first render

        setTimeout(function () {
          document.querySelector("#toolbar").setAttribute("data-animate", "");
        });
      };

      var onPreferenceChange = function onPreferenceChange() {
        var value = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : getAnimationPreference();

        if (value) {
          enableAnimation();
        } else {
          disableAnimation();
        }
      };

      var getAnimationPreference = function getAnimationPreference() {
        return animationPreference.has() ? animationPreference.get() : true;
      };

      var setAnimationPreference = function setAnimationPreference(value) {
        return animationPreference.set(value);
      };

      var enableAnimation = function enableAnimation() {
        document.documentElement.removeAttribute("data-animation-disabled");
      };

      var disableAnimation = function disableAnimation() {
        document.documentElement.setAttribute("data-animation-disabled", "");
      };

      var enableVariant = function enableVariant(rootNode, variables) {
        var nodesNotMatching = Array.from(rootNode.querySelectorAll("[".concat(attributeIndicatingACondition, "]")));
        nodesNotMatching.forEach(function (nodeNotMatching) {
          var conditionAttributeValue = nodeNotMatching.getAttribute(attributeIndicatingACondition);
          var matches = testCondition(conditionAttributeValue, variables);

          if (matches) {
            renameAttribute(nodeNotMatching, attributeIndicatingACondition, attributeIndicatingAMatch);
          }
        });
        var nodesMatching = Array.from(rootNode.querySelectorAll("[".concat(attributeIndicatingAMatch, "]")));
        nodesMatching.forEach(function (nodeMatching) {
          var conditionAttributeValue = nodeMatching.getAttribute(attributeIndicatingAMatch);
          var matches = testCondition(conditionAttributeValue, variables);

          if (!matches) {
            renameAttribute(nodeMatching, attributeIndicatingAMatch, attributeIndicatingACondition);
          }
        });
      };

      var testCondition = function testCondition(conditionAttributeValue, variables) {
        var condition = parseCondition(conditionAttributeValue);
        return Object.keys(variables).some(function (key) {
          if (condition.key !== key) {
            return false;
          } // the condition do not specify a value, any value is ok


          if (condition.value === undefined) {
            return true;
          }

          if (condition.value === variables[key]) {
            return true;
          }

          return false;
        });
      };

      var parseCondition = function parseCondition(conditionAttributeValue) {
        var colonIndex = conditionAttributeValue.indexOf(":");

        if (colonIndex === -1) {
          return {
            key: conditionAttributeValue,
            value: undefined
          };
        }

        return {
          key: conditionAttributeValue.slice(0, colonIndex),
          value: conditionAttributeValue.slice(colonIndex + 1)
        };
      };

      var attributeIndicatingACondition = "data-when";
      var attributeIndicatingAMatch = "data-when-active";

      var renameAttribute = function renameAttribute(node, name, newName) {
        node.setAttribute(newName, node.getAttribute(name));
        node.removeAttribute(name);
      };

      var createHorizontalBreakpoint = function createHorizontalBreakpoint(breakpointValue) {
        return createBreakpoint(windowWidthMeasure, breakpointValue);
      };

      var createMeasure = function createMeasure(_ref) {
        var compute = _ref.compute,
            register = _ref.register;
        var currentValue = compute();

        var get = function get() {
          return compute();
        };

        var changed = createSignal();

        var unregister = function unregister() {};

        if (register) {
          unregister = register(function () {
            var value = compute();

            if (value !== currentValue) {
              var previousValue = value;
              currentValue = value;
              changed.notify(value, previousValue);
            }
          });
        }

        return {
          get: get,
          changed: changed,
          unregister: unregister
        };
      };

      var createSignal = function createSignal() {
        var callbackArray = [];

        var listen = function listen(callback) {
          callbackArray.push(callback);
          return function () {
            var index = callbackArray.indexOf(callback);

            if (index > -1) {
              callbackArray.splice(index, 1);
            }
          };
        };

        var notify = function notify() {
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }

          callbackArray.slice().forEach(function (callback) {
            callback.apply(void 0, args);
          });
        };

        return {
          listen: listen,
          notify: notify
        };
      };

      var windowWidthMeasure = createMeasure({
        name: "window-width",
        compute: function compute() {
          return window.innerWidth;
        },
        register: function register(onchange) {
          window.addEventListener("resize", onchange);
          window.addEventListener("orientationchange", onchange);
          return function () {
            window.removeEventListener("resize", onchange);
            window.removeEventListener("orientationchange", onchange);
          };
        }
      });

      var createBreakpoint = function createBreakpoint(measure, breakpointValue) {
        var getBreakpointState = function getBreakpointState() {
          var value = measure.get();

          if (value < breakpointValue) {
            return "below";
          }

          if (value > breakpointValue) {
            return "above";
          }

          return "equals";
        };

        var currentBreakpointState = getBreakpointState();

        var isAbove = function isAbove() {
          return measure.get() > breakpointValue;
        };

        var isBelow = function isBelow() {
          return measure.get() < breakpointValue;
        };

        var breakpointChanged = createSignal();
        measure.changed.listen(function () {
          var breakpointState = getBreakpointState();

          if (breakpointState !== currentBreakpointState) {
            var breakpointStatePrevious = currentBreakpointState;
            currentBreakpointState = breakpointState;
            breakpointChanged.notify(breakpointState, breakpointStatePrevious);
          }
        });
        return {
          isAbove: isAbove,
          isBelow: isBelow,
          changed: breakpointChanged
        };
      }; // const windowScrollTop = createMeasure({
      //   name: "window-scroll-top",
      //   compute: () => window.scrollTop,
      //   register: (onchange) => {
      //     window.addEventListener("scroll", onchange)
      //     return () => {
      //       window.removeEventListener("scroll", onchange)
      //     }
      //   },
      // })

      var WINDOW_MEDIUM_WIDTH = 570;
      var renderExecutionInToolbar = function renderExecutionInToolbar(_ref) {
        var executedFileRelativeUrl = _ref.executedFileRelativeUrl;
        // reset file execution indicator ui
        applyExecutionIndicator();
        removeForceHideElement(document.querySelector("#execution-indicator")); // apply responsive design on fileInput if needed + add listener on resize screen

        var input = document.querySelector("#file-input");
        var fileWidthBreakpoint = createHorizontalBreakpoint(WINDOW_MEDIUM_WIDTH);

        var handleFileWidthBreakpoint = function handleFileWidthBreakpoint() {
          resizeInput(input, fileWidthBreakpoint);
        };

        handleFileWidthBreakpoint();
        fileWidthBreakpoint.changed.listen(handleFileWidthBreakpoint);
        input.value = executedFileRelativeUrl;
        resizeInput(input, fileWidthBreakpoint);
        activateToolbarSection(document.querySelector("#file"));
        removeForceHideElement(document.querySelector("#file"));

        window.parent.__jsenv__.executionResultPromise.then(function (_ref2) {
          var status = _ref2.status,
              startTime = _ref2.startTime,
              endTime = _ref2.endTime;
          var execution = {
            status: status,
            startTime: startTime,
            endTime: endTime
          };
          applyExecutionIndicator(execution);
          var executionStorageKey = executedFileRelativeUrl;
          var previousExecution = sessionStorage.hasOwnProperty(executionStorageKey) ? JSON.parse(sessionStorage.getItem(executionStorageKey)) : undefined;
          notifyExecutionResult(executedFileRelativeUrl, execution, previousExecution);
          sessionStorage.setItem(executedFileRelativeUrl, JSON.stringify(execution));
        });
      };

      var applyExecutionIndicator = function applyExecutionIndicator() {
        var _ref3 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
            _ref3$status = _ref3.status,
            status = _ref3$status === void 0 ? "running" : _ref3$status,
            startTime = _ref3.startTime,
            endTime = _ref3.endTime;

        var executionIndicator = document.querySelector("#execution-indicator");
        enableVariant(executionIndicator, {
          execution: status
        });
        var variantNode = executionIndicator.querySelector("[data-when-active]");

        variantNode.querySelector("button").onclick = function () {
          return toggleTooltip(executionIndicator);
        };

        variantNode.querySelector(".tooltip").textContent = computeText({
          status: status,
          startTime: startTime,
          endTime: endTime
        });
      };

      var computeText = function computeText(_ref4) {
        var status = _ref4.status,
            startTime = _ref4.startTime,
            endTime = _ref4.endTime;

        if (status === "completed") {
          return "Execution completed in ".concat(endTime - startTime, "ms");
        }

        if (status === "errored") {
          return "Execution failed in ".concat(endTime - startTime, "ms");
        }

        if (status === "running") {
          return "Executing...";
        }

        return "";
      };

      var resizeInput = function resizeInput(input, fileWidthBreakpoint) {
        var size = fileWidthBreakpoint.isBelow() ? 20 : 40;

        if (input.value.length > size) {
          input.style.width = "".concat(size, "ch");
        } else {
          input.style.width = "".concat(input.value.length, "ch");
        }
      };

      var COMPILE_ID_OTHERWISE = "otherwise";

      var computeCompileIdFromGroupId = function computeCompileIdFromGroupId(_ref) {
        var groupId = _ref.groupId,
            groupMap = _ref.groupMap;

        if (typeof groupId === "undefined") {
          if (COMPILE_ID_OTHERWISE in groupMap) {
            return COMPILE_ID_OTHERWISE;
          }

          var keys = Object.keys(groupMap);

          if (keys.length === 1) {
            return keys[0];
          }

          throw new Error(createUnexpectedGroupIdMessage({
            groupMap: groupMap
          }));
        }

        if (groupId in groupMap === false) {
          throw new Error(createUnexpectedGroupIdMessage({
            groupId: groupId,
            groupMap: groupMap
          }));
        }

        return groupId;
      };

      var createUnexpectedGroupIdMessage = function createUnexpectedGroupIdMessage(_ref2) {
        var _createDetailedMessag;

        var compileId = _ref2.compileId,
            groupMap = _ref2.groupMap;
        return createDetailedMessage("unexpected groupId.", (_createDetailedMessag = {}, _defineProperty(_createDetailedMessag, "expected compiled id", Object.keys(groupMap)), _defineProperty(_createDetailedMessag, "received compile id", compileId), _createDetailedMessag));
      };

      var firstMatch = function firstMatch(regexp, string) {
        var match = string.match(regexp);
        return match && match.length > 0 ? match[1] || undefined : undefined;
      };
      var secondMatch = function secondMatch(regexp, string) {
        var match = string.match(regexp);
        return match && match.length > 1 ? match[2] || undefined : undefined;
      };
      var userAgentToVersion = function userAgentToVersion(userAgent) {
        return firstMatch(/version\/(\d+(\.?_?\d+)+)/i, userAgent) || undefined;
      };

      var detectAndroid = function detectAndroid() {
        return navigatorToBrowser$1(window.navigator);
      };

      var navigatorToBrowser$1 = function navigatorToBrowser(_ref) {
        var userAgent = _ref.userAgent,
            appVersion = _ref.appVersion;

        if (/(android)/i.test(userAgent)) {
          return {
            name: "android",
            version: firstMatch(/Android (\d+(\.?_?\d+)+)/i, appVersion)
          };
        }

        return null;
      };

      var detectInternetExplorer = function detectInternetExplorer() {
        return userAgentToBrowser$5(window.navigator.userAgent);
      };

      var userAgentToBrowser$5 = function userAgentToBrowser(userAgent) {
        if (/msie|trident/i.test(userAgent)) {
          return {
            name: "ie",
            version: firstMatch(/(?:msie |rv:)(\d+(\.?_?\d+)+)/i, userAgent)
          };
        }

        return null;
      };

      var detectOpera = function detectOpera() {
        return userAgentToBrowser$4(window.navigator.userAgent);
      };

      var userAgentToBrowser$4 = function userAgentToBrowser(userAgent) {
        // opera below 13
        if (/opera/i.test(userAgent)) {
          return {
            name: "opera",
            version: userAgentToVersion(userAgent) || firstMatch(/(?:opera)[\s/](\d+(\.?_?\d+)+)/i, userAgent)
          };
        } // opera above 13


        if (/opr\/|opios/i.test(userAgent)) {
          return {
            name: "opera",
            version: firstMatch(/(?:opr|opios)[\s/](\S+)/i, userAgent) || userAgentToVersion(userAgent)
          };
        }

        return null;
      };

      var detectEdge = function detectEdge() {
        return userAgentToBrowser$3(window.navigator.userAgent);
      };

      var userAgentToBrowser$3 = function userAgentToBrowser(userAgent) {
        if (/edg([ea]|ios)/i.test(userAgent)) {
          return {
            name: "edge",
            version: secondMatch(/edg([ea]|ios)\/(\d+(\.?_?\d+)+)/i, userAgent)
          };
        }

        return null;
      };

      var detectFirefox = function detectFirefox() {
        return userAgentToBrowser$2(window.navigator.userAgent);
      };

      var userAgentToBrowser$2 = function userAgentToBrowser(userAgent) {
        if (/firefox|iceweasel|fxios/i.test(userAgent)) {
          return {
            name: "firefox",
            version: firstMatch(/(?:firefox|iceweasel|fxios)[\s/](\d+(\.?_?\d+)+)/i, userAgent)
          };
        }

        return null;
      };

      var detectChrome = function detectChrome() {
        return userAgentToBrowser$1(window.navigator.userAgent);
      };

      var userAgentToBrowser$1 = function userAgentToBrowser(userAgent) {
        if (/chromium/i.test(userAgent)) {
          return {
            name: "chrome",
            version: firstMatch(/(?:chromium)[\s/](\d+(\.?_?\d+)+)/i, userAgent) || userAgentToVersion(userAgent)
          };
        }

        if (/chrome|crios|crmo/i.test(userAgent)) {
          return {
            name: "chrome",
            version: firstMatch(/(?:chrome|crios|crmo)\/(\d+(\.?_?\d+)+)/i, userAgent)
          };
        }

        return null;
      };

      var detectSafari = function detectSafari() {
        return userAgentToBrowser(window.navigator.userAgent);
      };

      var userAgentToBrowser = function userAgentToBrowser(userAgent) {
        if (/safari|applewebkit/i.test(userAgent)) {
          return {
            name: "safari",
            version: userAgentToVersion(userAgent)
          };
        }

        return null;
      };

      var detectElectron = function detectElectron() {
        return null;
      }; // TODO

      var detectIOS = function detectIOS() {
        return navigatorToBrowser(window.navigator);
      };

      var navigatorToBrowser = function navigatorToBrowser(_ref) {
        var userAgent = _ref.userAgent,
            appVersion = _ref.appVersion;

        if (/iPhone;/.test(userAgent)) {
          return {
            name: "ios",
            version: firstMatch(/OS (\d+(\.?_?\d+)+)/i, appVersion)
          };
        }

        if (/iPad;/.test(userAgent)) {
          return {
            name: "ios",
            version: firstMatch(/OS (\d+(\.?_?\d+)+)/i, appVersion)
          };
        }

        return null;
      };

      // https://github.com/Ahmdrza/detect-browser/blob/26254f85cf92795655a983bfd759d85f3de850c6/detect-browser.js#L1

      var detectorCompose = function detectorCompose(detectors) {
        return function () {
          var i = 0;

          while (i < detectors.length) {
            var _detector = detectors[i];
            i++;

            var result = _detector();

            if (result) {
              return result;
            }
          }

          return null;
        };
      };

      var detector = detectorCompose([detectOpera, detectInternetExplorer, detectEdge, detectFirefox, detectChrome, detectSafari, detectElectron, detectIOS, detectAndroid]);
      var detectBrowser = function detectBrowser() {
        var _ref = detector() || {},
            _ref$name = _ref.name,
            name = _ref$name === void 0 ? "other" : _ref$name,
            _ref$version = _ref.version,
            version = _ref$version === void 0 ? "unknown" : _ref$version;

        return {
          name: normalizeName(name),
          version: normalizeVersion(version)
        };
      };

      var normalizeName = function normalizeName(name) {
        return name.toLowerCase();
      };

      var normalizeVersion = function normalizeVersion(version) {
        if (version.indexOf(".") > -1) {
          var parts = version.split("."); // remove extraneous .

          return parts.slice(0, 3).join(".");
        }

        if (version.indexOf("_") > -1) {
          var _parts = version.split("_"); // remove extraneous _


          return _parts.slice(0, 3).join("_");
        }

        return version;
      };

      var valueToVersion = function valueToVersion(value) {
        if (typeof value === "number") {
          return numberToVersion(value);
        }

        if (typeof value === "string") {
          return stringToVersion(value);
        }

        throw new TypeError("version must be a number or a string, got ".concat(value));
      };

      var numberToVersion = function numberToVersion(number) {
        return {
          major: number,
          minor: 0,
          patch: 0
        };
      };

      var stringToVersion = function stringToVersion(string) {
        if (string.indexOf(".") > -1) {
          var parts = string.split(".");
          return {
            major: Number(parts[0]),
            minor: parts[1] ? Number(parts[1]) : 0,
            patch: parts[2] ? Number(parts[2]) : 0
          };
        }

        if (isNaN(string)) {
          return {
            major: 0,
            minor: 0,
            patch: 0
          };
        }

        return {
          major: Number(string),
          minor: 0,
          patch: 0
        };
      };

      var versionCompare = function versionCompare(versionA, versionB) {
        var semanticVersionA = valueToVersion(versionA);
        var semanticVersionB = valueToVersion(versionB);
        var majorDiff = semanticVersionA.major - semanticVersionB.major;

        if (majorDiff > 0) {
          return majorDiff;
        }

        if (majorDiff < 0) {
          return majorDiff;
        }

        var minorDiff = semanticVersionA.minor - semanticVersionB.minor;

        if (minorDiff > 0) {
          return minorDiff;
        }

        if (minorDiff < 0) {
          return minorDiff;
        }

        var patchDiff = semanticVersionA.patch - semanticVersionB.patch;

        if (patchDiff > 0) {
          return patchDiff;
        }

        if (patchDiff < 0) {
          return patchDiff;
        }

        return 0;
      };

      var versionIsBelow = function versionIsBelow(versionSupposedBelow, versionSupposedAbove) {
        return versionCompare(versionSupposedBelow, versionSupposedAbove) < 0;
      };

      var findHighestVersion = function findHighestVersion() {
        for (var _len = arguments.length, values = new Array(_len), _key = 0; _key < _len; _key++) {
          values[_key] = arguments[_key];
        }

        if (values.length === 0) throw new Error("missing argument");
        return values.reduce(function (highestVersion, value) {
          if (versionIsBelow(highestVersion, value)) {
            return value;
          }

          return highestVersion;
        });
      };

      var resolveGroup = function resolveGroup(_ref, groupMap) {
        var name = _ref.name,
            version = _ref.version;
        return Object.keys(groupMap).find(function (compileIdCandidate) {
          var minRuntimeVersions = groupMap[compileIdCandidate].minRuntimeVersions;
          var versionForGroup = minRuntimeVersions[name];

          if (!versionForGroup) {
            return false;
          }

          var highestVersion = findHighestVersion(version, versionForGroup);
          return highestVersion === version;
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

      function _invoke(body, then) {
        var result = body();

        if (result && result.then) {
          return result.then(then);
        }

        return then(result);
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

      var scanBrowserRuntimeFeatures = _async$1(function () {
        var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
            _ref$coverageHandledF = _ref.coverageHandledFromOutside,
            coverageHandledFromOutside = _ref$coverageHandledF === void 0 ? false : _ref$coverageHandledF,
            _ref$failFastOnFeatur = _ref.failFastOnFeatureDetection,
            failFastOnFeatureDetection = _ref$failFastOnFeatur === void 0 ? false : _ref$failFastOnFeatur;

        return _await(fetchJson("/.jsenv/__compile_server_meta__.json"), function (_ref2) {
          var outDirectoryRelativeUrl = _ref2.outDirectoryRelativeUrl,
              inlineImportMapIntoHTML = _ref2.inlineImportMapIntoHTML,
              customCompilerPatterns = _ref2.customCompilerPatterns,
              compileServerGroupMap = _ref2.compileServerGroupMap;
          var browser = detectBrowser();
          var compileId = computeCompileIdFromGroupId({
            groupId: resolveGroup(browser, compileServerGroupMap),
            groupMap: compileServerGroupMap
          });
          var groupInfo = compileServerGroupMap[compileId];
          var featuresReport = {
            importmap: undefined,
            dynamicImport: undefined,
            topLevelAwait: undefined,
            jsonImportAssertions: undefined,
            cssImportAssertions: undefined,
            newStylesheet: undefined
          };
          return _await(detectSupportedFeatures({
            featuresReport: featuresReport,
            failFastOnFeatureDetection: failFastOnFeatureDetection,
            inlineImportMapIntoHTML: inlineImportMapIntoHTML
          }), function () {
            return _await(pluginRequiredNamesFromGroupInfo(groupInfo, {
              featuresReport: featuresReport,
              coverageHandledFromOutside: coverageHandledFromOutside
            }), function (pluginRequiredNameArray) {
              var canAvoidCompilation = customCompilerPatterns.length === 0 && pluginRequiredNameArray.length === 0 && featuresReport.importmap && featuresReport.dynamicImport && featuresReport.topLevelAwait;
              return {
                canAvoidCompilation: canAvoidCompilation,
                featuresReport: featuresReport,
                customCompilerPatterns: customCompilerPatterns,
                pluginRequiredNameArray: pluginRequiredNameArray,
                inlineImportMapIntoHTML: inlineImportMapIntoHTML,
                outDirectoryRelativeUrl: outDirectoryRelativeUrl,
                compileId: compileId,
                browser: browser
              };
            });
          });
        });
      });

      var detectSupportedFeatures = _async$1(function (_ref3) {
        var featuresReport = _ref3.featuresReport,
            failFastOnFeatureDetection = _ref3.failFastOnFeatureDetection,
            inlineImportMapIntoHTML = _ref3.inlineImportMapIntoHTML;
        // start testing importmap support first and not in paralell
        // so that there is not module script loaded beore importmap is injected
        // it would log an error in chrome console and return undefined
        return _await(supportsImportmap({
          // chrome supports inline but not remote importmap
          // https://github.com/WICG/import-maps/issues/235
          // at this stage we won't know if the html file will use
          // an importmap or not and if that importmap is inline or specified with an src
          // so we should test if browser support local and remote importmap.
          // But there exploring server can inline importmap by transforming html
          // and in that case we can test only the local importmap support
          // so we test importmap support and the remote one
          remote: !inlineImportMapIntoHTML
        }), function (importmap) {
          featuresReport.importmap = importmap;

          if (!importmap && failFastOnFeatureDetection) {
            return;
          }

          return _call$1(supportsDynamicImport, function (dynamicImport) {
            featuresReport.dynamicImport = dynamicImport;

            if (!dynamicImport && failFastOnFeatureDetection) {
              return;
            }

            return _call$1(supportsTopLevelAwait, function (topLevelAwait) {
              featuresReport.topLevelAwait = topLevelAwait;
            });
          });
        });
      });

      var pluginRequiredNamesFromGroupInfo = _async$1(function (groupInfo, _ref4) {
        var featuresReport = _ref4.featuresReport,
            coverageHandledFromOutside = _ref4.coverageHandledFromOutside;
        var pluginRequiredNameArray = groupInfo.pluginRequiredNameArray;
        var requiredPluginNames = pluginRequiredNameArray.slice();

        var markPluginAsSupported = function markPluginAsSupported(name) {
          var index = requiredPluginNames.indexOf(name);

          if (index > -1) {
            requiredPluginNames.splice(index, 1);
          }
        }; // When instrumentation CAN be handed by playwright
        // https://playwright.dev/docs/api/class-chromiumcoverage#chromiumcoveragestartjscoverageoptions
        // coverageHandledFromOutside is true and "transform-instrument" becomes non mandatory


        if (coverageHandledFromOutside) {
          markPluginAsSupported("transform-instrument");
        }

        return _invoke(function () {
          if (pluginRequiredNameArray.includes("transform-import-assertions")) {
            return _call$1(supportsJsonImportAssertions, function (jsonImportAssertions) {
              featuresReport.jsonImportAssertions = jsonImportAssertions;
              return _call$1(supportsCssImportAssertions, function (cssImportAssertions) {
                featuresReport.cssImportAssertions = cssImportAssertions;

                if (jsonImportAssertions && cssImportAssertions) {
                  markPluginAsSupported("transform-import-assertions");
                }
              });
            });
          }
        }, function () {
          if (pluginRequiredNameArray.includes("new-stylesheet-as-jsenv-import")) {
            var newStylesheet = supportsNewStylesheet();
            featuresReport.newStylesheet = newStylesheet;
            markPluginAsSupported("new-stylesheet-as-jsenv-import");
          }

          return requiredPluginNames;
        });
      });

      var supportsNewStylesheet = function supportsNewStylesheet() {
        try {
          // eslint-disable-next-line no-new
          new CSSStyleSheet();
          return true;
        } catch (e) {
          return false;
        }
      };

      var supportsImportmap = _async$1(function () {
        var _ref5 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
            _ref5$remote = _ref5.remote,
            remote = _ref5$remote === void 0 ? true : _ref5$remote;

        var specifier = asBase64Url("export default false");
        var importMap = {
          imports: _defineProperty({}, specifier, asBase64Url("export default true"))
        };
        var importmapScript = document.createElement("script");
        var importmapString = JSON.stringify(importMap, null, "  ");
        importmapScript.type = "importmap";

        if (remote) {
          importmapScript.src = "data:application/json;base64,".concat(window.btoa(importmapString));
        } else {
          importmapScript.textContent = importmapString;
        }

        document.body.appendChild(importmapScript);
        var scriptModule = document.createElement("script");
        scriptModule.type = "module";
        scriptModule.src = asBase64Url("import supported from \"".concat(specifier, "\"; window.__importmap_supported = supported"));
        return new Promise(function (resolve, reject) {
          scriptModule.onload = function () {
            var supported = window.__importmap_supported;
            delete window.__importmap_supported;
            document.body.removeChild(scriptModule);
            document.body.removeChild(importmapScript);
            resolve(supported);
          };

          scriptModule.onerror = function () {
            document.body.removeChild(scriptModule);
            document.body.removeChild(importmapScript);
            reject();
          };

          document.body.appendChild(scriptModule);
        });
      });

      var supportsDynamicImport = _async$1(function () {
        var moduleSource = asBase64Url("export default 42");
        return _catch(function () {
          return _await(module.import(moduleSource), function (namespace) {
            return namespace.default === 42;
          });
        }, function () {
          return false;
        });
      });

      var supportsTopLevelAwait = _async$1(function () {
        var moduleSource = asBase64Url("export default await Promise.resolve(42)");
        return _catch(function () {
          return _await(module.import(moduleSource), function (namespace) {
            return namespace.default === 42;
          });
        }, function () {
          return false;
        });
      });

      var supportsJsonImportAssertions = _async$1(function () {
        var jsonBase64Url = asBase64Url("42", "application/json");
        var moduleSource = asBase64Url("export { default } from \"".concat(jsonBase64Url, "\" assert { type: \"json\" }"));
        return _catch(function () {
          return _await(module.import(moduleSource), function (namespace) {
            return namespace.default === 42;
          });
        }, function () {
          return false;
        });
      });

      var supportsCssImportAssertions = _async$1(function () {
        var cssBase64Url = asBase64Url("p { color: red; }", "text/css");
        var moduleSource = asBase64Url("export { default } from \"".concat(cssBase64Url, "\" assert { type: \"css\" }"));
        return _catch(function () {
          return _await(module.import(moduleSource), function (namespace) {
            return namespace.default instanceof CSSStyleSheet;
          });
        }, function () {
          return false;
        });
      });

      var asBase64Url = function asBase64Url(text) {
        var mimeType = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "application/javascript";
        return "data:".concat(mimeType, ";base64,").concat(window.btoa(text));
      };

      var renderCompilationInToolbar = function renderCompilationInToolbar(_ref) {
        var compileGroup = _ref.compileGroup;
        var browserSupportRootNode = document.querySelector("#browser_support");
        var filesCompilationRootNode = document.querySelector("#files_compilation");
        removeForceHideElement(browserSupportRootNode);
        removeForceHideElement(filesCompilationRootNode);
        scanBrowserRuntimeFeatures().then(function (_ref2) {
          var canAvoidCompilation = _ref2.canAvoidCompilation,
              featuresReport = _ref2.featuresReport,
              customCompilerPatterns = _ref2.customCompilerPatterns,
              pluginRequiredNameArray = _ref2.pluginRequiredNameArray,
              inlineImportMapIntoHTML = _ref2.inlineImportMapIntoHTML,
              outDirectoryRelativeUrl = _ref2.outDirectoryRelativeUrl,
              compileId = _ref2.compileId;
          var browserSupport = canAvoidCompilation ? inlineImportMapIntoHTML ? "partial" : "full" : "no";
          enableVariant(browserSupportRootNode, {
            browserSupport: browserSupport
          });

          if (browserSupport === "no") {
            browserSupportRootNode.querySelector("a.browser_support_read_more_link").onclick = function () {
              // eslint-disable-next-line no-alert
              window.alert("Source files needs to be compiled to be executable in this browser because: ".concat(getBrowserSupportMessage({
                missingOnly: true,
                featuresReport: featuresReport,
                customCompilerPatterns: customCompilerPatterns,
                pluginRequiredNameArray: pluginRequiredNameArray,
                inlineImportMapIntoHTML: inlineImportMapIntoHTML
              })));
            };
          } else if (browserSupport === "partial") {
            browserSupportRootNode.querySelector("a.browser_support_read_more_link").onclick = function () {
              // eslint-disable-next-line no-alert
              window.alert("Source files (except html) can be executed directly in this browser because: ".concat(getBrowserSupportMessage({
                featuresReport: featuresReport,
                customCompilerPatterns: customCompilerPatterns,
                pluginRequiredNameArray: pluginRequiredNameArray,
                inlineImportMapIntoHTML: inlineImportMapIntoHTML
              })));
            };
          } else if (browserSupport === "full") {
            browserSupportRootNode.querySelector("a.browser_support_read_more_link").onclick = function () {
              // eslint-disable-next-line no-alert
              window.alert("Source files can be executed directly in this browser because: ".concat(getBrowserSupportMessage({
                featuresReport: featuresReport,
                customCompilerPatterns: customCompilerPatterns,
                pluginRequiredNameArray: pluginRequiredNameArray,
                inlineImportMapIntoHTML: inlineImportMapIntoHTML
              })));
            };
          }

          var filesCompilation = compileGroup.compileId ? "yes" : inlineImportMapIntoHTML ? "html_only" : "no";
          enableVariant(filesCompilationRootNode, {
            filesCompilation: filesCompilation,
            compiled: compileGroup.compileId ? "yes" : "no"
          });

          filesCompilationRootNode.querySelector("a.go_to_source_link").onclick = function () {
            window.parent.location = "/".concat(compileGroup.fileRelativeUrl);
          };

          filesCompilationRootNode.querySelector("a.go_to_compiled_link").onclick = function () {
            window.parent.location = "/".concat(outDirectoryRelativeUrl).concat(compileId, "/").concat(compileGroup.fileRelativeUrl);
          };

          var shouldCompile = filesCompilation !== "yes" && browserSupport === "no";

          if (shouldCompile) {
            document.querySelector(".files_compilation_text").setAttribute("data-warning", "");
            document.querySelector(".browser_support_text").setAttribute("data-warning", "");
            document.querySelector("#settings-button").setAttribute("data-warning", "");
          } else {
            document.querySelector(".files_compilation_text").removeAttribute("data-warning");
            document.querySelector(".browser_support_text").removeAttribute("data-warning");
            document.querySelector("#settings-button").removeAttribute("data-warning");
          }
        });
      };

      var getBrowserSupportMessage = function getBrowserSupportMessage(_ref3) {
        var missingOnly = _ref3.missingOnly,
            featuresReport = _ref3.featuresReport,
            customCompilerPatterns = _ref3.customCompilerPatterns,
            pluginRequiredNameArray = _ref3.pluginRequiredNameArray,
            inlineImportMapIntoHTML = _ref3.inlineImportMapIntoHTML;
        var parts = [];
        var importmapSupported = featuresReport.importmapSupported;

        if (importmapSupported) {
          if (!missingOnly) {
            if (inlineImportMapIntoHTML) {
              parts.push("importmaps are supported (only when inlined in html files)");
            } else {
              parts.push("importmaps are supported");
            }
          }
        } else {
          parts.push("importmaps are not supported");
        }

        var dynamicImportSupported = featuresReport.dynamicImportSupported;

        if (dynamicImportSupported) {
          if (!missingOnly) {
            parts.push("dynamic imports are supported");
          }
        } else {
          parts.push("dynamic imports are not supported");
        }

        var topLevelAwaitSupported = featuresReport.topLevelAwaitSupported;

        if (topLevelAwaitSupported) {
          if (!missingOnly) {
            parts.push("top level await is supported");
          }
        } else {
          parts.push("top level await is not supported");
        }

        var pluginRequiredCount = pluginRequiredNameArray.length;

        if (pluginRequiredCount === 0) {
          if (!missingOnly) {
            parts.push("all plugins are natively supported");
          }
        } else {
          parts.push("".concat(pluginRequiredCount, " plugins are mandatory: ").concat(pluginRequiredNameArray));
        }

        var customCompilerCount = customCompilerPatterns.length;

        if (customCompilerCount === 0) ; else {
          parts.push("".concat(customCompilerCount, " custom compilers enabled: ").concat(customCompilerPatterns));
        }

        return "\n- ".concat(parts.join("\n- "));
      };

      var livereloadingAvailableOnServer = false;
      var parentEventSourceClient = window.parent.__jsenv_event_source_client__;
      var initToolbarEventSource = function initToolbarEventSource(_ref) {
        var livereloading = _ref.livereloading;
        removeForceHideElement(document.querySelector("#eventsource-indicator"));
        livereloadingAvailableOnServer = livereloading;

        if (!livereloadingAvailableOnServer) {
          disableLivereloadSetting();
        }

        parentEventSourceClient.setConnectionStatusChangeCallback = function () {
          updateEventSourceIndicator();
        };

        var livereloadCheckbox = document.querySelector("#toggle-livereload");
        livereloadCheckbox.checked = parentEventSourceClient.isLivereloadEnabled();

        livereloadCheckbox.onchange = function () {
          parentEventSourceClient.setLivereloadPreference(livereloadCheckbox.checked);
          updateEventSourceIndicator();
        };

        updateEventSourceIndicator();
      };

      var updateEventSourceIndicator = function updateEventSourceIndicator() {
        var eventSourceIndicator = document.querySelector("#eventsource-indicator");
        var fileChanges = parentEventSourceClient.getFileChanges();
        var changeCount = Object.keys(fileChanges).length;
        var eventSourceConnectionState = parentEventSourceClient.getConnectionStatus();
        enableVariant(eventSourceIndicator, {
          eventsource: eventSourceConnectionState,
          livereload: parentEventSourceClient.isLivereloadEnabled() ? "on" : "off",
          changes: changeCount > 0 ? "yes" : "no"
        });
        var variantNode = document.querySelector("#eventsource-indicator > [data-when-active]");

        variantNode.querySelector("button").onclick = function () {
          toggleTooltip(eventSourceIndicator);
        };

        if (eventSourceConnectionState === "connecting") {
          variantNode.querySelector("a").onclick = function () {
            parentEventSourceClient.disconnect();
          };
        } else if (eventSourceConnectionState === "connected") {
          removeAutoShowTooltip(eventSourceIndicator);

          if (changeCount) {
            var changeLink = variantNode.querySelector(".eventsource-changes-link");
            changeLink.innerHTML = changeCount;

            changeLink.onclick = function () {
              console.log(JSON.stringify(fileChanges, null, "  "), fileChanges); // eslint-disable-next-line no-alert

              window.parent.alert(JSON.stringify(fileChanges, null, "  "));
            };

            variantNode.querySelector(".eventsource-reload-link").onclick = function () {
              parentEventSourceClient.reloadIfNeeded();
            };
          }
        } else if (eventSourceConnectionState === "disconnected") {
          autoShowTooltip(eventSourceIndicator);

          variantNode.querySelector("a").onclick = function () {
            parentEventSourceClient.connect();
          };
        }
      };

      var disableLivereloadSetting = function disableLivereloadSetting() {
        document.querySelector(".settings-livereload").setAttribute("data-disabled", "true");
        document.querySelector(".settings-livereload").setAttribute("title", "Livereload not available: disabled by server");
        document.querySelector("#toggle-livereload").disabled = true;
      };

      var WINDOW_SMALL_WIDTH = 420;
      var makeToolbarResponsive = function makeToolbarResponsive() {
        // apply responsive design on toolbar icons if needed + add listener on resize screen
        // ideally we should listen breakpoint once, for now restore toolbar
        var overflowMenuBreakpoint = createHorizontalBreakpoint(WINDOW_SMALL_WIDTH);

        var handleOverflowMenuBreakpoint = function handleOverflowMenuBreakpoint() {
          responsiveToolbar(overflowMenuBreakpoint);
        };

        handleOverflowMenuBreakpoint();
        overflowMenuBreakpoint.changed.listen(handleOverflowMenuBreakpoint); // overflow menu

        document.querySelector("#overflow-menu-button").onclick = function () {
          return toggleOverflowMenu();
        };
      };

      var responsiveToolbar = function responsiveToolbar(overflowMenuBreakpoint) {
        // close all tooltips in case opened
        hideTooltip(document.querySelector("#eventsource-indicator"));
        hideTooltip(document.querySelector("#execution-indicator")); // close settings box in case opened

        deactivateToolbarSection(document.querySelector("#settings"));

        if (overflowMenuBreakpoint.isBelow()) {
          enableOverflow();
        } else {
          disableOverflow();
        }
      };

      var moves = [];

      var enableOverflow = function enableOverflow() {
        // move elements from toolbar to overflow menu
        var responsiveToolbarElements = document.querySelectorAll("[data-responsive-toolbar-element]");
        var overflowMenu = document.querySelector("#overflow-menu"); // keep a placeholder element to know where to move them back

        moves = Array.from(responsiveToolbarElements).map(function (element) {
          var placeholder = document.createElement("div");
          placeholder.style.display = "none";
          placeholder.setAttribute("data-placeholder", "");
          element.parentNode.replaceChild(placeholder, element);
          overflowMenu.appendChild(element);
          return {
            element: element,
            placeholder: placeholder
          };
        });
        document.querySelector("#toolbar").setAttribute("data-overflow-menu-enabled", "");
        removeForceHideElement(document.querySelector("#overflow-menu-button"));
      };

      var disableOverflow = function disableOverflow() {
        // close overflow menu in case it's open & unselect toggleOverflowMenu button in case it's selected
        hideOverflowMenu();
        deactivateToolbarSection(document.querySelector("#overflow-menu"));
        moves.forEach(function (_ref) {
          var element = _ref.element,
              placeholder = _ref.placeholder;
          placeholder.parentNode.replaceChild(element, placeholder);
        });
        moves = [];
        document.querySelector("#toolbar").removeAttribute("data-overflow-menu-enabled");
        forceHideElement(document.querySelector("#overflow-menu-button"));
      };

      var toggleOverflowMenu = function toggleOverflowMenu() {
        if (overflowMenuIsVisible()) {
          hideOverflowMenu();
        } else {
          showOverflowMenu();
        }
      };

      var overflowMenuIsVisible = function overflowMenuIsVisible() {
        var toolbar = document.querySelector("#toolbar");
        return toolbar.hasAttribute("data-overflow-menu-visible");
      };

      var showOverflowMenu = function showOverflowMenu() {
        var toolbar = document.querySelector("#toolbar");
        document.querySelector("#overflow-menu").setAttribute("data-animate", "");
        toolbar.setAttribute("data-overflow-menu-visible", "");
      };

      var hideOverflowMenu = function hideOverflowMenu() {
        var toolbar = document.querySelector("#toolbar");
        toolbar.removeAttribute("data-overflow-menu-visible");
        document.querySelector("#overflow-menu").removeAttribute("data-animate");
      };

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

      var toolbarVisibilityPreference = createPreference("toolbar");

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

      var renderToolbar = _async(function () {
        var executedFileCompiledUrl = window.parent.location.href;
        var compileServerOrigin = window.parent.location.origin; // this should not block the whole toolbar rendering + interactivity

        return _call(fetchExploringJson, function (exploringConfig) {
          var outDirectoryRelativeUrl = exploringConfig.outDirectoryRelativeUrl,
              livereloading = exploringConfig.livereloading;
          var compileGroup = getCompileGroup({
            executedFileCompiledUrl: executedFileCompiledUrl,
            outDirectoryRelativeUrl: outDirectoryRelativeUrl,
            compileServerOrigin: compileServerOrigin
          });
          var executedFileRelativeUrl = compileGroup.fileRelativeUrl;
          var toolbarOverlay = document.querySelector("#toolbar-overlay");

          toolbarOverlay.onclick = function () {
            hideAllTooltip();
            hideSettings();
          };

          var toolbarElement = document.querySelector("#toolbar");
          exposeOnParentWindow({
            toolbar: {
              element: toolbarElement,
              show: showToolbar,
              hide: function hide() {
                return hideToolbar();
              },
              toggle: toogleToolbar
            }
          });
          var toolbarVisible = toolbarVisibilityPreference.has() ? toolbarVisibilityPreference.get() : true;

          if (toolbarVisible) {
            showToolbar({
              animate: false
            });
          } else {
            hideToolbar({
              animate: false
            });
          }

          renderToolbarNotification();
          makeToolbarResponsive();
          renderToolbarSettings();
          renderToolbarAnimation();
          renderToolbarTheme();
          renderExecutionInToolbar({
            executedFileRelativeUrl: executedFileRelativeUrl
          });
          renderCompilationInToolbar({
            compileGroup: compileGroup
          }); // this might become active but we need to detect this somehow

          deactivateToolbarSection(document.querySelector("#file-list-link"));
          initToolbarEventSource({
            executedFileRelativeUrl: executedFileRelativeUrl,
            livereloading: livereloading
          }); // if user click enter or space quickly while closing toolbar
          // it will cancel the closing
          // that's why I used toggleToolbar and not hideToolbar

          document.querySelector("#button-close-toolbar").onclick = function () {
            return toogleToolbar();
          };
        });
      });

      var exposeOnParentWindow = function exposeOnParentWindow(object) {
        var __jsenv__ = window.parent.__jsenv__;

        if (!__jsenv__) {
          __jsenv__ = {};
          window.parent.__jsenv__ = {};
        }

        Object.assign(__jsenv__, object);
      };

      var toogleToolbar = function toogleToolbar() {
        if (toolbarIsVisible()) {
          hideToolbar();
        } else {
          showToolbar();
        }
      };

      var toolbarIsVisible = function toolbarIsVisible() {
        return document.documentElement.hasAttribute("data-toolbar-visible");
      };

      var hideToolbar = function hideToolbar() {
        // toolbar hidden by default, nothing to do to hide it by default
        sendEventToParent("toolbar-visibility-change", false);
      }; // (by the way it might be cool to have the toolbar auto show when)
      // it has something to say (being disconnected from livereload server)


      var showToolbar = function showToolbar() {
        var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
            _ref$animate = _ref.animate,
            animate = _ref$animate === void 0 ? true : _ref$animate;

        toolbarVisibilityPreference.set(true);

        if (animate) {
          document.documentElement.setAttribute("data-toolbar-animation", "");
        } else {
          document.documentElement.removeAttribute("data-toolbar-animation");
        }

        document.documentElement.setAttribute("data-toolbar-visible", "");
        sendEventToParent("toolbar-visibility-change", true);
        var toolbarIframe = getToolbarIframe();
        var toolbarIframeParent = toolbarIframe.parentNode;
        var parentWindow = window.parent;
        var parentDocumentElement = parentWindow.document.compatMode === "CSS1Compat" ? parentWindow.document.documentElement : parentWindow.document.body;
        var scrollYMax = parentDocumentElement.scrollHeight - parentWindow.innerHeight;
        var scrollY = parentDocumentElement.scrollTop;
        var scrollYRemaining = scrollYMax - scrollY;
        setStyles(toolbarIframeParent, {
          "transition-property": "padding-bottom",
          "transition-duration": "300ms"
        }); // maybe we should use js animation here because we would not conflict with css

        var restoreToolbarIframeParentStyles = setStyles(toolbarIframeParent, {
          "scroll-padding-bottom": "40px",
          // same here we should add 40px
          "padding-bottom": "40px" // if there is already one we should add 40px

        });
        var restoreToolbarIframeStyles = setStyles(toolbarIframe, {
          height: "40px",
          visibility: "visible"
        });

        if (scrollYRemaining < 40 && scrollYMax > 0) {
          var scrollEnd = scrollY + 40;
          startJavaScriptAnimation({
            duration: 300,
            onProgress: function onProgress(_ref2) {
              var progress = _ref2.progress;
              var value = scrollY + (scrollEnd - scrollY) * progress;
              parentDocumentElement.scrollTop = value;
            }
          });
        }

        hideToolbar = function hideToolbar() {
          restoreToolbarIframeParentStyles();
          restoreToolbarIframeStyles();
          hideTooltip(document.querySelector("#eventsource-indicator"));
          hideTooltip(document.querySelector("#execution-indicator"));
          toolbarVisibilityPreference.set(false);

          if (animate) {
            document.documentElement.setAttribute("data-toolbar-animation", "");
          } else {
            document.documentElement.removeAttribute("data-toolbar-animation");
          }

          document.documentElement.removeAttribute("data-toolbar-visible");
          sendEventToParent("toolbar-visibility-change", false);
        };
      };

      var getCompileGroup = function getCompileGroup(_ref3) {
        var executedFileCompiledUrl = _ref3.executedFileCompiledUrl,
            outDirectoryRelativeUrl = _ref3.outDirectoryRelativeUrl,
            compileServerOrigin = _ref3.compileServerOrigin;
        var outDirectoryServerUrl = String(new URL(outDirectoryRelativeUrl, compileServerOrigin));

        if (urlIsInsideOf(executedFileCompiledUrl, outDirectoryServerUrl)) {
          var afterCompileDirectory = urlToRelativeUrl(executedFileCompiledUrl, outDirectoryServerUrl);
          var slashIndex = afterCompileDirectory.indexOf("/");
          var fileRelativeUrl = afterCompileDirectory.slice(slashIndex + 1);
          return {
            fileRelativeUrl: fileRelativeUrl,
            outDirectoryRelativeUrl: outDirectoryRelativeUrl,
            compileId: afterCompileDirectory.slice(0, slashIndex)
          };
        }

        return {
          fileRelativeUrl: new URL(executedFileCompiledUrl).pathname.slice(1),
          outDirectoryRelativeUrl: outDirectoryRelativeUrl,
          compileId: null
        };
      };

      var sendEventToParent = function sendEventToParent(type, value) {
        window.parent.postMessage({
          jsenv: true,
          type: type,
          value: value
        }, "*");
      };

      window.renderToolbar = renderToolbar;

    })
  };
}));

//# sourceMappingURL=toolbar.main-6417da98.js.map