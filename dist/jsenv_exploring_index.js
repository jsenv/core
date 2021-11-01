(function () {
  'use strict';

  var memoize = function memoize(compute) {
    var memoized = false;
    var memoizedValue;

    var fnWithMemoization = function fnWithMemoization() {
      if (memoized) {
        return memoizedValue;
      } // if compute is recursive wait for it to be fully done before storing the lockValue
      // so set locked later


      memoizedValue = compute.apply(void 0, arguments);
      memoized = true;
      return memoizedValue;
    };

    fnWithMemoization.forget = function () {
      var value = memoizedValue;
      memoized = false;
      memoizedValue = undefined;
      return value;
    };

    return fnWithMemoization;
  };

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

  var fetchPolyfill = function fetchPolyfill() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _call$2(loadPolyfill, function (_ref) {
      var fetchUsingXHR = _ref.fetchUsingXHR;
      return fetchUsingXHR.apply(void 0, args);
    });
  };

  var loadPolyfill = memoize(function () {
    return Promise.resolve().then(function () { return fetchUsingXHR$1; });
  });
  var fetchUrl$1 = typeof window.fetch === "function" && typeof window.AbortController === "function" ? window.fetch : fetchPolyfill;

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

  var nativeTypeOf = function nativeTypeOf(obj) {
    return typeof obj;
  };

  var customTypeOf = function customTypeOf(obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  };

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? nativeTypeOf : customTypeOf;

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

  var fetchUsingXHR$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    fetchUsingXHR: fetchUsingXHR
  });

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

      throw new Error(createDetailedMessage("Cannot communicate with exploring server due to a network error", _defineProperty({}, "error stack", e.stack)));
    });
  });

  function _await(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  var fetchJSON = _async(function (url, options) {
    return _await(fetchUrl$1(url, options), function (response) {
      return _await(response.json());
    });
  });

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

  var groupPreference = createPreference("group");

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

  var run = function run() {
    return _call(fetchExploringJson, function (_ref) {
      var projectDirectoryUrl = _ref.projectDirectoryUrl,
          explorableConfig = _ref.explorableConfig,
          outDirectoryRelativeUrl = _ref.outDirectoryRelativeUrl;
      return _await(fetchJSON("/.jsenv/explorables.json", {
        method: "GET"
      }), function (files) {
        var compileServerOrigin = document.location.origin;
        var outDirectoryUrl = String(new URL(outDirectoryRelativeUrl, compileServerOrigin));
        var documentUrl = document.location.href;
        var compileId;
        var outDirectoryIndex = documentUrl.indexOf(outDirectoryUrl);

        if (outDirectoryIndex === 0) {
          var afterOutDirectory = documentUrl.slice(outDirectoryUrl.length);
          compileId = afterOutDirectory.split("/")[0];
        } else {
          compileId = null;
        }

        var renderHtml = function renderHtml() {
          // const mainHtmlFileRelativeUrl = "index.html"
          // const mainFileLink = document.querySelector("#main_file_link")
          // const mainFileUrl = urlToVisitFromRelativeUrl(mainHtmlFileRelativeUrl)
          // mainFileLink.href = mainFileUrl
          // mainFileLink.textContent = `${mainHtmlFileRelativeUrl}`
          // const mainFileIframe = document.querySelector(`#main_file_iframe`)
          // mainFileIframe.src = mainFileUrl
          var fileListElement = document.querySelector("[data-page=\"file-list\"]").cloneNode(true);
          var directoryName = directoryUrlToDirectoryName(projectDirectoryUrl);
          var span = fileListElement.querySelector("#directory_relative_url");
          span.title = projectDirectoryUrl;
          span.textContent = directoryName;
          var h4 = fileListElement.querySelector("h4");
          var ul = fileListElement.querySelector("ul");
          ul.innerHTML = files.map(function (file) {
            return "<li>\n          <a\n            class=\"execution-link\"\n            data-relative-url=".concat(file.relativeUrl, "\n            href=").concat(urlToVisitFromRelativeUrl(file.relativeUrl), "\n          >\n            ").concat(file.relativeUrl, "\n          </a>\n        </li>");
          }).join("");
          var groupFieldset = fileListElement.querySelector("#filter-group-set");
          var groupNames = Object.keys(explorableConfig);
          groupFieldset.innerHTML = groupNames.map(function (key) {
            return "<label data-contains-hidden-input class=\"item\">\n  <input type=\"radio\" name=\"filter-group\" value=\"".concat(key, "\"/>\n  <span>").concat(key, "</span>\n</label>");
          }).join("");
          var currentGroup = groupPreference.has() ? groupPreference.get() : groupNames[0];
          Array.from(groupFieldset.querySelectorAll("input")).forEach(function (inputRadio) {
            inputRadio.checked = inputRadio.value === currentGroup;

            inputRadio.onchange = function () {
              if (inputRadio.checked) {
                groupPreference.set(inputRadio.value);
                enableGroup(inputRadio.value);
              }
            };
          });

          var enableGroup = function enableGroup(groupName) {
            var arrayOfElementToShow = [];
            var arrayOfElementToHide = [];
            files.forEach(function (file) {
              var fileLink = fileListElement.querySelector("a[data-relative-url=\"".concat(file.relativeUrl, "\"]"));
              var fileLi = fileLink.parentNode;

              if (file.meta[groupName]) {
                arrayOfElementToShow.push(fileLi);
              } else {
                arrayOfElementToHide.push(fileLi);
              }
            });
            arrayOfElementToShow.forEach(function (element) {
              element.removeAttribute("data-force-hide");
            });
            arrayOfElementToHide.forEach(function (element) {
              element.setAttribute("data-force-hide", "");
            });
            h4.innerHTML = arrayOfElementToShow.length === 0 ? "No file found.\n              Config for this section: <pre>".concat(JSON.stringify(explorableConfig[groupName], null, "  "), "</pre>") : "".concat(arrayOfElementToShow.length, " files found. Click on the one you want to execute");
          };

          enableGroup(currentGroup);
          document.querySelector("main").appendChild(fileListElement);
          makeMenuScrollable();
        };

        var urlToVisitFromRelativeUrl = function urlToVisitFromRelativeUrl(relativeUrl) {
          if (compileId) {
            return "".concat(compileServerOrigin, "/").concat(outDirectoryRelativeUrl).concat(compileId, "/").concat(relativeUrl);
          }

          return "".concat(compileServerOrigin, "/").concat(relativeUrl);
        };

        var makeMenuScrollable = function makeMenuScrollable() {
          var getMenuWrapperSize = function getMenuWrapperSize() {
            return document.querySelector(".menu-wrapper").getBoundingClientRect().width;
          };

          var menuWrapperSize = getMenuWrapperSize();

          var getMenuSize = function getMenuSize() {
            return document.querySelector(".menu").getBoundingClientRect().width;
          };

          var menuSize = getMenuSize();
          var menuVisibleSize = menuWrapperSize;
          var menuInvisibleSize = menuSize - menuVisibleSize;

          var getMenuPosition = function getMenuPosition() {
            return document.querySelector(".menu-wrapper").scrollLeft;
          };

          var scrollDuration = 300;
          var leftPaddle = document.querySelector(".left-paddle");
          var rightPaddle = document.querySelector(".right-paddle");

          var handleMenuScroll = function handleMenuScroll() {
            menuInvisibleSize = menuSize - menuWrapperSize;
            var menuPosition = getMenuPosition();
            var menuEndOffset = menuInvisibleSize; // show & hide the paddles, depending on scroll position

            if (menuPosition <= 0 && menuEndOffset <= 0) {
              // hide both paddles if the window is large enough to display all tabs
              leftPaddle.classList.add("hidden");
              rightPaddle.classList.add("hidden");
            } else if (menuPosition <= 0) {
              leftPaddle.classList.add("hidden");
              rightPaddle.classList.remove("hidden");
            } else if (menuPosition < Math.floor(menuEndOffset)) {
              // show both paddles in the middle
              leftPaddle.classList.remove("hidden");
              rightPaddle.classList.remove("hidden");
            } else if (menuPosition >= Math.floor(menuEndOffset)) {
              leftPaddle.classList.remove("hidden");
              rightPaddle.classList.add("hidden");
            }
          };

          handleMenuScroll();

          window.onresize = function () {
            menuWrapperSize = getMenuWrapperSize();
            menuSize = getMenuSize();
            handleMenuScroll();
          }; // finally, what happens when we are actually scrolling the menu


          document.querySelector(".menu-wrapper").onscroll = function () {
            handleMenuScroll();
          }; // scroll to left


          rightPaddle.onclick = function () {
            var scrollStart = document.querySelector(".menu-wrapper").scrollLeft;
            var scrollEnd = scrollStart + menuWrapperSize;
            startJavaScriptAnimation({
              duration: scrollDuration,
              onProgress: function onProgress(_ref2) {
                var progress = _ref2.progress;
                document.querySelector(".menu-wrapper").scrollLeft = scrollStart + (scrollEnd - scrollStart) * progress;
              }
            });
          }; // scroll to right


          leftPaddle.onclick = function () {
            var scrollStart = document.querySelector(".menu-wrapper").scrollLeft;
            var scrollEnd = scrollStart - menuWrapperSize;
            startJavaScriptAnimation({
              duration: scrollDuration,
              onProgress: function onProgress(_ref3) {
                var progress = _ref3.progress;
                document.querySelector(".menu-wrapper").scrollLeft = scrollStart + (scrollEnd - scrollStart) * progress;
              }
            });
          };
        };

        var directoryUrlToDirectoryName = function directoryUrlToDirectoryName(directoryUrl) {
          var slashLastIndex = directoryUrl.lastIndexOf("/", // ignore last slash
          directoryUrl.length - 2);
          if (slashLastIndex === -1) return "";
          return directoryUrl.slice(slashLastIndex + 1);
        };

        renderHtml();
      });
    });
  };

  run();

})();

//# sourceMappingURL=jsenv_exploring_index.js.map