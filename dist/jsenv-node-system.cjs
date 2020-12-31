'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var util = require('@jsenv/util');
var module$1 = require('module');
var https = require('https');
var server = require('@jsenv/server');
var logger = require('@jsenv/logger');
var importMap = require('@jsenv/import-map');
var _uneval = require('@jsenv/uneval');
var vm = require('vm');

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

function _objectSpread (target) {
  for (var i = 1; i < arguments.length; i++) {
    // eslint-disable-next-line prefer-rest-params
    var source = arguments[i] === null ? {} : arguments[i];

    if (i % 2) {
      // eslint-disable-next-line no-loop-func
      ownKeys(Object(source), true).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      // eslint-disable-next-line no-loop-func
      ownKeys(Object(source)).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }

  return target;
} // This function is different to "Reflect.ownKeys". The enumerableOnly
// filters on symbol properties only. Returned string properties are always
// enumerable. It is good to use in objectSpread.

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    }); // eslint-disable-next-line prefer-spread

    keys.push.apply(keys, symbols);
  }

  return keys;
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

/* global __filename */
var filenameContainsBackSlashes = __filename.indexOf("\\") > -1;
var url = filenameContainsBackSlashes ? "file:///".concat(__filename.replace(/\\/g, "/")) : "file://".concat(__filename);

var require$1 = module$1.createRequire(url);

function _await(value, then, direct) {
  if (direct) {
    return then ? then(value) : value;
  }

  if (!value || !value.then) {
    value = Promise.resolve(value);
  }

  return then ? value.then(then) : value;
}

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

https.globalAgent.options.rejectUnauthorized = false;
var fetchUrl = _async(function (url) {
  var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var _ref$ignoreHttpsError = _ref.ignoreHttpsError,
      ignoreHttpsError = _ref$ignoreHttpsError === void 0 ? true : _ref$ignoreHttpsError,
      rest = _objectWithoutProperties(_ref, ["ignoreHttpsError"]);

  return _await(server.fetchUrl(url, _objectSpread({
    ignoreHttpsError: ignoreHttpsError
  }, rest)), function (response) {
    return {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      headers: server.headersToObject(response.headers),
      text: response.text.bind(response),
      json: response.json.bind(response),
      blob: response.blob.bind(response),
      arrayBuffer: response.arrayBuffer.bind(response)
    };
  });
});

/* eslint-disable no-eq-null, eqeqeq */
function arrayLikeToArray(arr, len) {
  if (len == null || len > arr.length) len = arr.length;
  var arr2 = new Array(len);

  for (var i = 0; i < len; i++) {
    arr2[i] = arr[i];
  }

  return arr2;
}

var arrayWithoutHoles = (function (arr) {
  if (Array.isArray(arr)) return arrayLikeToArray(arr);
});

// eslint-disable-next-line consistent-return
var iterableToArray = (function (iter) {
  if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter);
});

/* eslint-disable consistent-return */
function unsupportedIterableToArray(o, minLen) {
  if (!o) return;
  if (typeof o === "string") return arrayLikeToArray(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor) n = o.constructor.name;
  if (n === "Map" || n === "Set") return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return arrayLikeToArray(o, minLen);
}

var nonIterableSpread = (function () {
  throw new TypeError("Invalid attempt to spread non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
});

var _toConsumableArray = (function (arr) {
  return arrayWithoutHoles(arr) || iterableToArray(arr) || unsupportedIterableToArray(arr) || nonIterableSpread();
});

var stackToString = function stackToString(stack, _ref) {
  var error = _ref.error,
      indent = _ref.indent;
  var name = error.name || "Error";
  var message = error.message || "";
  var stackString = stack.map(function (callSite) {
    return "\n".concat(indent, "at ").concat(callSite);
  }).join("");
  return "".concat(name, ": ").concat(message).concat(stackString);
};

var nativeTypeOf = function nativeTypeOf(obj) {
  return typeof obj;
};

var customTypeOf = function customTypeOf(obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? nativeTypeOf : customTypeOf;

var parseDataUrl = function parseDataUrl(dataUrl) {
  var afterDataProtocol = dataUrl.slice("data:".length);
  var commaIndex = afterDataProtocol.indexOf(",");
  var beforeComma = afterDataProtocol.slice(0, commaIndex);
  var mediaType;
  var base64Flag;

  if (beforeComma.endsWith(";base64")) {
    mediaType = beforeComma.slice(0, -";base64".length);
    base64Flag = true;
  } else {
    mediaType = beforeComma;
    base64Flag = false;
  }

  var afterComma = afterDataProtocol.slice(commaIndex + 1);
  return {
    mediaType: mediaType === "" ? "text/plain;charset=US-ASCII" : mediaType,
    base64Flag: base64Flag,
    data: afterComma
  };
};
var dataUrlToRawData = function dataUrlToRawData(_ref2) {
  var base64Flag = _ref2.base64Flag,
      data = _ref2.data;
  return base64Flag ? base64ToString(data) : data;
};
var dataToBase64 = (typeof window === "undefined" ? "undefined" : _typeof(window)) === "object" ? window.atob : function (data) {
  return Buffer.from(data).toString("base64");
};
var base64ToString = (typeof window === "undefined" ? "undefined" : _typeof(window)) === "object" ? window.btoa : function (base64String) {
  return Buffer.from(base64String, "base64").toString("utf8");
};

var getJavaScriptSourceMappingUrl = function getJavaScriptSourceMappingUrl(javaScriptSource) {
  var sourceMappingUrl;
  replaceSourceMappingUrl(javaScriptSource, javascriptSourceMappingUrlCommentRegexp, function (value) {
    sourceMappingUrl = value;
  });
  return sourceMappingUrl;
};
var javascriptSourceMappingUrlCommentRegexp = /\/\/ ?# ?sourceMappingURL=([^\s'"]+)/g;

var replaceSourceMappingUrl = function replaceSourceMappingUrl(source, regexp, callback) {
  var lastSourceMappingUrl;
  var matchSourceMappingUrl;

  while (matchSourceMappingUrl = regexp.exec(source)) {
    lastSourceMappingUrl = matchSourceMappingUrl;
  }

  if (lastSourceMappingUrl) {
    var index = lastSourceMappingUrl.index;
    var before = source.slice(0, index);
    var after = source.slice(index);
    var mappedAfter = after.replace(regexp, function (match, firstGroup) {
      return callback(firstGroup);
    });
    return "".concat(before).concat(mappedAfter);
  }

  return source;
};

var startsWithWindowsDriveLetter = function startsWithWindowsDriveLetter(string) {
  var firstChar = string[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;
  var secondChar = string[1];
  if (secondChar !== ":") return false;
  return true;
};
var windowsFilePathToUrl = function windowsFilePathToUrl(windowsFilePath) {
  return "file:///".concat(replaceBackSlashesWithSlashes(windowsFilePath));
};
var replaceBackSlashesWithSlashes = function replaceBackSlashesWithSlashes(string) {
  return string.replace(/\\/g, "/");
};

function _await$1(value, then, direct) {
  if (direct) {
    return then ? then(value) : value;
  }

  if (!value || !value.then) {
    value = Promise.resolve(value);
  }

  return then ? value.then(then) : value;
}

function _invoke(body, then) {
  var result = body();

  if (result && result.then) {
    return result.then(then);
  }

  return then(result);
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

var remapCallSite = _async$1(function (callSite, _ref) {
  var _exit = false;
  var urlToSourcemapConsumer = _ref.urlToSourcemapConsumer,
      resolveFile = _ref.resolveFile,
      readErrorStack = _ref.readErrorStack,
      onFailure = _ref.onFailure;

  if (callSite.isNative()) {
    return callSite;
  } // Most call sites will return the source file from getFileName(), but code
  // passed to eval() ending in "//# sourceURL=..." will return the source file
  // from getScriptNameOrSourceURL() instead


  var source = callSite.getFileName() || callSite.getScriptNameOrSourceURL();
  return _invoke(function () {
    if (source) {
      var line = callSite.getLineNumber();
      var column = callSite.getColumnNumber() - 1;
      return _await$1(remapSourcePosition({
        source: source,
        line: line,
        column: column,
        resolveFile: resolveFile,
        urlToSourcemapConsumer: urlToSourcemapConsumer,
        readErrorStack: readErrorStack,
        onFailure: onFailure
      }), function (originalPosition) {
        var callSiteClone = cloneCallSite(callSite);

        callSiteClone.getFunctionName = function () {
          return originalPosition.name || callSite.getFunctionName();
        };

        callSiteClone.getFileName = function () {
          return originalPosition.source;
        };

        callSiteClone.getLineNumber = function () {
          return originalPosition.line;
        };

        callSiteClone.getColumnNumber = function () {
          return originalPosition.column + 1;
        };

        callSiteClone.getScriptNameOrSourceURL = function () {
          return originalPosition.source;
        };

        _exit = true;
        return callSiteClone;
      });
    }
  }, function (_result) {
    var _exit2 = false;
    if (_exit) return _result;
    // Code called using eval() needs special handling
    return _invoke(function () {
      if (callSite.isEval()) {
        var origin = callSite.getEvalOrigin();
        return _invoke(function () {
          if (origin) {
            var callSiteClone = cloneCallSite(callSite);
            return _await$1(remapEvalOrigin(origin, {
              resolveFile: resolveFile,
              urlToSourcemapConsumer: urlToSourcemapConsumer,
              readErrorStack: readErrorStack,
              onFailure: onFailure
            }), function (originalEvalOrigin) {
              callSiteClone.getEvalOrigin = function () {
                return originalEvalOrigin;
              };

              _exit2 = true;
              return callSiteClone;
            });
          }
        }, function (_result2) {
          if (_exit2) return _result2;
          _exit2 = true;
          return callSite;
        });
      }
    }, function (_result3) {
      return _exit2 ? _result3 : callSite;
    }); // If we get here then we were unable to change the source position
  });
});

var cloneCallSite = function cloneCallSite(callSite) {
  var callSiteClone = {};
  methods.forEach(function (name) {
    callSiteClone[name] = function () {
      return callSite[name]();
    };
  });

  callSiteClone.toString = function () {
    return callSiteToFunctionCall(callSiteClone);
  };

  return callSiteClone;
};

var methods = ["getColumnNumber", "getEvalOrigin", "getFileName", "getFunction", "getFunctionName", "getLineNumber", "getMethodName", "getPosition", "getScriptNameOrSourceURL", "getThis", "getTypeName", "isConstructor", "isEval", "isNative", "isToplevel", "toString"];

var callSiteToFunctionCall = function callSiteToFunctionCall(callSite) {
  var fileLocation = callSiteToFileLocation(callSite);
  var isConstructor = callSite.isConstructor();
  var isMethodCall = !callSite.isToplevel() && !isConstructor;

  if (isMethodCall) {
    return "".concat(callSiteToMethodCall(callSite), " (").concat(fileLocation, ")");
  }

  var functionName = callSite.getFunctionName();

  if (isConstructor) {
    return "new ".concat(functionName || "<anonymous>", " (").concat(fileLocation, ")");
  }

  if (functionName) {
    return "".concat(functionName, " (").concat(fileLocation, ")");
  }

  return "".concat(fileLocation);
};

var callSiteToMethodCall = function callSiteToMethodCall(callSite) {
  var functionName = callSite.getFunctionName();
  var typeName = callSiteToType(callSite);

  if (!functionName) {
    return "".concat(typeName, ".<anonymous>");
  }

  var methodName = callSite.getMethodName();
  var as = generateAs({
    methodName: methodName,
    functionName: functionName
  });

  if (typeName && !functionName.startsWith(typeName)) {
    return "".concat(typeName, ".").concat(functionName).concat(as);
  }

  return "".concat(functionName).concat(as);
};

var generateAs = function generateAs(_ref2) {
  var methodName = _ref2.methodName,
      functionName = _ref2.functionName;
  if (!methodName) return "";
  if (functionName.indexOf(".".concat(methodName)) === functionName.length - methodName.length - 1) return "";
  return " [as ".concat(methodName, "]");
};

var callSiteToType = function callSiteToType(callSite) {
  var typeName = callSite.getTypeName(); // Fixes shim to be backward compatible with Node v0 to v4

  if (typeName === "[object Object]") {
    return "null";
  }

  return typeName;
};

var callSiteToFileLocation = function callSiteToFileLocation(callSite) {
  if (callSite.isNative()) return "native";
  var sourceFile = callSiteToSourceFile(callSite);
  var lineNumber = callSite.getLineNumber();

  if (lineNumber === null) {
    return sourceFile;
  }

  var columnNumber = callSite.getColumnNumber();

  if (!columnNumber) {
    return "".concat(sourceFile, ":").concat(lineNumber);
  }

  return "".concat(sourceFile, ":").concat(lineNumber, ":").concat(columnNumber);
};

var callSiteToSourceFile = function callSiteToSourceFile(callSite) {
  var fileName = callSite.getScriptNameOrSourceURL();

  if (fileName) {
    return fileName;
  } // Source code does not originate from a file and is not native, but we
  // can still get the source position inside the source string, e.g. in
  // an eval string.


  if (callSite.isEval()) {
    return "".concat(callSite.getEvalOrigin(), ", <anonymous>");
  }

  return "<anonymous>";
}; // Parses code generated by FormatEvalOrigin(), a function inside V8:
// https://code.google.com/p/v8/source/browse/trunk/src/messages.js


var remapEvalOrigin = _async$1(function (origin, _ref3) {
  var _exit3 = false;
  var resolveFile = _ref3.resolveFile,
      urlToSourcemapConsumer = _ref3.urlToSourcemapConsumer,
      onFailure = _ref3.onFailure;
  // Most eval() calls are in this format
  var topLevelEvalMatch = /^eval at ([^(]+) \((.+):(\d+):(\d+)\)$/.exec(origin);
  return _invoke(function () {
    if (topLevelEvalMatch) {
      var source = topLevelEvalMatch[2];
      var line = Number(topLevelEvalMatch[3]);
      var column = topLevelEvalMatch[4] - 1;
      return _await$1(remapSourcePosition({
        source: source,
        line: line,
        column: column,
        resolveFile: resolveFile,
        urlToSourcemapConsumer: urlToSourcemapConsumer,
        onFailure: onFailure
      }), function (originalPosition) {
        _exit3 = true;
        return "eval at ".concat(topLevelEvalMatch[1], " (").concat(originalPosition.source, ":").concat(originalPosition.line, ":").concat(originalPosition.column + 1, ")");
      });
    }
  }, function (_result4) {
    var _exit4 = false;
    if (_exit3) return _result4;
    // Parse nested eval() calls using recursion
    var nestedEvalMatch = /^eval at ([^(]+) \((.+)\)$/.exec(origin);
    return _invoke(function () {
      if (nestedEvalMatch) {
        return _await$1(remapEvalOrigin(nestedEvalMatch[2], {
          resolveFile: resolveFile,
          urlToSourcemapConsumer: urlToSourcemapConsumer,
          onFailure: onFailure
        }), function (originalEvalOrigin) {
          _exit4 = true;
          return "eval at ".concat(nestedEvalMatch[1], " (").concat(originalEvalOrigin, ")");
        });
      }
    }, function (_result5) {
      return _exit4 ? _result5 : origin;
    }); // Make sure we still return useful information if we didn't find anything
  });
});

var remapSourcePosition = _async$1(function (_ref4) {
  var source = _ref4.source,
      line = _ref4.line,
      column = _ref4.column,
      resolveFile = _ref4.resolveFile,
      urlToSourcemapConsumer = _ref4.urlToSourcemapConsumer,
      readErrorStack = _ref4.readErrorStack,
      onFailure = _ref4.onFailure;
  var position = {
    source: source,
    line: line,
    column: column
  };
  var url = sourceToUrl(source, {
    resolveFile: resolveFile
  });
  return url ? _await$1(urlToSourcemapConsumer(url), function (sourceMapConsumer) {
    if (!sourceMapConsumer) return position;

    try {
      var originalPosition = sourceMapConsumer.originalPositionFor(position); // Only return the original position if a matching line was found. If no
      // matching line is found then we return position instead, which will cause
      // the stack trace to print the path and line for the compiled file. It is
      // better to give a precise location in the compiled file than a vague
      // location in the original file.

      var originalSource = originalPosition.source;
      if (originalSource === null) return position;
      originalPosition.source = resolveFile(originalSource, url, {
        type: "file-original"
      });
      return originalPosition;
    } catch (e) {
      var _createDetailedMessag;

      onFailure(logger.createDetailedMessage("error while remapping position.", (_createDetailedMessag = {}, _defineProperty(_createDetailedMessag, "error stack", readErrorStack(e)), _defineProperty(_createDetailedMessag, "source", source), _defineProperty(_createDetailedMessag, "line", line), _defineProperty(_createDetailedMessag, "column", column), _createDetailedMessag)));
      return position;
    }
  }) : position;
});

var sourceToUrl = function sourceToUrl(source, _ref5) {
  var resolveFile = _ref5.resolveFile;

  if (startsWithScheme(source)) {
    return source;
  } // linux filesystem path


  if (source[0] === "/") {
    return resolveFile(source);
  } // be careful, due to babel or something like that we might receive paths like
  // C:/directory/file.js (without backslashes we would expect on windows)
  // In that case we consider C: is the signe we are on windows
  // And I avoid to rely on process.platform === "win32" because this file might be executed in chrome


  if (startsWithWindowsDriveLetter(source)) {
    return windowsFilePathToUrl(source);
  } // I don't think we will ever encounter relative file in the stack trace
  // but if it ever happens we are safe :)


  if (source.slice(0, 2) === "./" || source.slice(0, 3) === "../") {
    return resolveFile(source);
  } // we have received a "bare specifier" for the source
  // it happens for internal/process/task_queues.js for instance
  // if we do return resolveFile(source) it will be converted to
  // file:///C:/project-directory/internal/process/task_queues.js in node
  // and
  // http://domain.com/internal/process/task_queues.js
  // but the file will certainly be a 404
  // and if not it won't be the right file anyway
  // for now we assume "bare specifier" in the stack trace
  // are internal files that are pointless to try to remap


  return null;
};

var startsWithScheme = function startsWithScheme(string) {
  return /^[a-zA-Z]{2,}:/.test(string);
};

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

function _invoke$1(body, then) {
  var result = body();

  if (result && result.then) {
    return result.then(then);
  }

  return then(result);
}

function _continue(value, then) {
  return value && value.then ? value.then(then) : then(value);
}

var getOriginalCallsites = _async$2(function (_ref) {
  var stack = _ref.stack,
      resolveFile = _ref.resolveFile,
      fetchFile = _ref.fetchFile,
      SourceMapConsumer = _ref.SourceMapConsumer,
      readErrorStack = _ref.readErrorStack,
      onFailure = _ref.onFailure;
  var urlToSourcemapConsumer = memoizeByFirstArgStringValue(_async$2(function (stackTraceFileUrl) {
    var _exit = false;
    return _catch(function () {
      var text;
      return _continue(_catch(function () {
        return _await$2(fetchFile(stackTraceFileUrl), function (fileResponse) {
          var status = fileResponse.status;

          if (status !== 200) {
            if (status === 404) {
              onFailure("stack trace file not found at ".concat(stackTraceFileUrl));
            } else {
              var _createDetailedMessag;

              onFailure(logger.createDetailedMessage("unexpected response fetching stack trace file.", (_createDetailedMessag = {}, _defineProperty(_createDetailedMessag, "response status", status), _defineProperty(_createDetailedMessag, "response text", fileResponse.body), _defineProperty(_createDetailedMessag, "stack trace file", stackTraceFileUrl), _createDetailedMessag)));
            }

            _exit = true;
            return null;
          }

          return _await$2(fileResponse.text(), function (_fileResponse$text) {
            text = _fileResponse$text;
          });
        });
      }, function (e) {
        var _createDetailedMessag2;

        onFailure(logger.createDetailedMessage("error while fetching stack trace file.", (_createDetailedMessag2 = {}, _defineProperty(_createDetailedMessag2, "fetch error stack", readErrorStack(e)), _defineProperty(_createDetailedMessag2, "stack trace file", stackTraceFileUrl), _createDetailedMessag2)));
        _exit = true;
        return null;
      }), function (_result) {
        var _exit2 = false;
        if (_exit) return _result;
        var jsSourcemapUrl = getJavaScriptSourceMappingUrl(text);

        if (!jsSourcemapUrl) {
          return null;
        }

        var sourcemapUrl;
        var sourcemapString;
        return _invoke$1(function () {
          if (jsSourcemapUrl.startsWith("data:")) {
            sourcemapUrl = stackTraceFileUrl;
            sourcemapString = dataUrlToRawData(parseDataUrl(jsSourcemapUrl));
          } else {
            sourcemapUrl = resolveFile(jsSourcemapUrl, stackTraceFileUrl, {
              type: "source-map"
            });
            return _catch(function () {
              return _await$2(fetchFile(sourcemapUrl), function (sourcemapResponse) {
                var _exit3 = false;
                var status = sourcemapResponse.status;
                return _invoke$1(function () {
                  if (status !== 200) {
                    return _invoke$1(function () {
                      if (status === 404) {
                        onFailure("sourcemap file not found at ".concat(sourcemapUrl));
                      } else {
                        var _temp2 = "unexpected response for sourcemap file.";
                        return _await$2(sourcemapResponse.text(), function (_sourcemapResponse$te) {
                          var _createDetailedMessag3;

                          onFailure(logger.createDetailedMessage(_temp2, (_createDetailedMessag3 = {}, _defineProperty(_createDetailedMessag3, "response status", status), _defineProperty(_createDetailedMessag3, "response text", _sourcemapResponse$te), _defineProperty(_createDetailedMessag3, "sourcemap url", sourcemapUrl), _createDetailedMessag3)));
                        });
                      }
                    }, function () {
                      _exit2 = true;
                      return null;
                    });
                  }
                }, function (_result3) {
                  return _exit3 ? _result3 : _await$2(sourcemapResponse.text(), function (_sourcemapResponse$te2) {
                    sourcemapString = _sourcemapResponse$te2;
                  });
                });
              });
            }, function (e) {
              var _createDetailedMessag4;

              onFailure(logger.createDetailedMessage("error while fetching sourcemap.", (_createDetailedMessag4 = {}, _defineProperty(_createDetailedMessag4, "fetch error stack", readErrorStack(e)), _defineProperty(_createDetailedMessag4, "sourcemap url", sourcemapUrl), _createDetailedMessag4)));
              _exit2 = true;
              return null;
            });
          }
        }, function (_result4) {
          if (_exit2) return _result4;
          var sourceMap;

          try {
            sourceMap = JSON.parse(sourcemapString);
          } catch (e) {
            var _createDetailedMessag5;

            onFailure(logger.createDetailedMessage("error while parsing sourcemap.", (_createDetailedMessag5 = {}, _defineProperty(_createDetailedMessag5, "parse error stack", readErrorStack(e)), _defineProperty(_createDetailedMessag5, "sourcemap url", sourcemapUrl), _createDetailedMessag5)));
            return null;
          }

          var _sourceMap = sourceMap,
              sourcesContent = _sourceMap.sourcesContent;

          if (!sourcesContent) {
            sourcesContent = [];
            sourceMap.sourcesContent = sourcesContent;
          }

          var firstSourceMapSourceFailure = null;
          return _await$2(Promise.all(sourceMap.sources.map(_async$2(function (source, index) {
            if (index in sourcesContent) return;
            var sourcemapSourceUrl = resolveFile(source, sourcemapUrl, {
              type: "source"
            });
            return _catch(function () {
              return _await$2(fetchFile(sourcemapSourceUrl), function (sourceResponse) {
                var _exit4 = false;
                var status = sourceResponse.status;
                return _invoke$1(function () {
                  if (status !== 200) {
                    if (firstSourceMapSourceFailure) {
                      _exit4 = true;
                      return;
                    }

                    if (status === 404) {
                      var _createDetailedMessag6;

                      firstSourceMapSourceFailure = logger.createDetailedMessage("sourcemap source not found.", (_createDetailedMessag6 = {}, _defineProperty(_createDetailedMessag6, "sourcemap source url", sourcemapSourceUrl), _defineProperty(_createDetailedMessag6, "sourcemap url", sourcemapUrl), _createDetailedMessag6));
                      _exit4 = true;
                      return;
                    }

                    var _temp4 = "unexpected response for sourcemap source.";
                    return _await$2(sourceResponse.text(), function (_sourceResponse$text) {
                      var _createDetailedMessag7;

                      firstSourceMapSourceFailure = logger.createDetailedMessage(_temp4, (_createDetailedMessag7 = {}, _defineProperty(_createDetailedMessag7, "response status", status), _defineProperty(_createDetailedMessag7, "response text", _sourceResponse$text), _defineProperty(_createDetailedMessag7, "sourcemap source url", sourcemapSourceUrl), _defineProperty(_createDetailedMessag7, "sourcemap url", sourcemapUrl), _createDetailedMessag7));
                      _exit4 = true;
                    });
                  }
                }, function (_result6) {
                  return _exit4 ? _result6 : _await$2(sourceResponse.text(), function (sourceString) {
                    sourcesContent[index] = sourceString;
                  });
                });
              });
            }, function (e) {
              var _createDetailedMessag8;

              if (firstSourceMapSourceFailure) return;
              firstSourceMapSourceFailure = logger.createDetailedMessage("error while fetching sourcemap source.", (_createDetailedMessag8 = {}, _defineProperty(_createDetailedMessag8, "fetch error stack", readErrorStack(e)), _defineProperty(_createDetailedMessag8, "sourcemap source url", sourcemapSourceUrl), _defineProperty(_createDetailedMessag8, "sourcemap url", sourcemapUrl), _createDetailedMessag8));
            });
          }))), function () {
            if (firstSourceMapSourceFailure) {
              onFailure(firstSourceMapSourceFailure);
              return null;
            }

            return new SourceMapConsumer(sourceMap);
          });
        });
      });
    }, function (e) {
      var _createDetailedMessag9;

      onFailure(logger.createDetailedMessage("error while preparing a sourceMap consumer for a stack trace file.", (_createDetailedMessag9 = {}, _defineProperty(_createDetailedMessag9, "error stack", readErrorStack(e)), _defineProperty(_createDetailedMessag9, "stack trace file", stackTraceFileUrl), _createDetailedMessag9)));
      return null;
    });
  }));
  return Promise.all(stack.map(function (callSite) {
    return remapCallSite(callSite, {
      resolveFile: resolveFile,
      urlToSourcemapConsumer: urlToSourcemapConsumer,
      readErrorStack: readErrorStack,
      onFailure: onFailure
    });
  }));
});

var memoizeByFirstArgStringValue = function memoizeByFirstArgStringValue(fn) {
  var stringValueCache = {};
  return function (firstArgValue) {
    if (firstArgValue in stringValueCache) return stringValueCache[firstArgValue];
    var value = fn(firstArgValue);
    stringValueCache[firstArgValue] = value;
    return value;
  };
};

function _await$3(value, then, direct) {
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

function _invoke$2(body, then) {
  var result = body();

  if (result && result.then) {
    return result.then(then);
  }

  return then(result);
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

var installErrorStackRemapping = function installErrorStackRemapping(_ref) {
  var fetchFile = _ref.fetchFile,
      resolveFile = _ref.resolveFile,
      SourceMapConsumer = _ref.SourceMapConsumer,
      _ref$indent = _ref.indent,
      indent = _ref$indent === void 0 ? "  " : _ref$indent;

  if (typeof fetchFile !== "function") {
    throw new TypeError("fetchFile must be a function, got ".concat(fetchFile));
  }

  if (typeof SourceMapConsumer !== "function") {
    throw new TypeError("sourceMapConsumer must be a function, got ".concat(SourceMapConsumer));
  }

  if (typeof indent !== "string") {
    throw new TypeError("indent must be a string, got ".concat(indent));
  }

  var errorRemappingCache = new WeakMap();
  var errorRemapFailureCallbackMap = new WeakMap();
  var installed = false;
  var previousPrepareStackTrace = Error.prepareStackTrace;

  var install = function install() {
    if (installed) return;
    installed = true;
    Error.prepareStackTrace = prepareStackTrace;
  };

  var uninstall = function uninstall() {
    if (!installed) return;
    installed = false;
    Error.prepareStackTrace = previousPrepareStackTrace;
  }; // ensure we do not use prepareStackTrace for thoose error
  // otherwise we would recursively remap error stack
  // and if the reason causing the failure is still here
  // it would create an infinite loop


  var readErrorStack = function readErrorStack(error) {
    uninstall();
    var stack = error.stack;
    install();
    return stack;
  };

  var prepareStackTrace = function prepareStackTrace(error, stack) {
    var onFailure = function onFailure(failureData) {
      var failureCallbackArray = errorRemapFailureCallbackMap.get(error);

      if (failureCallbackArray) {
        failureCallbackArray.forEach(function (callback) {
          return callback(failureData);
        });
      }
    };

    var stackRemappingPromise = getOriginalCallsites({
      stack: stack,
      error: error,
      resolveFile: resolveFile,
      fetchFile: memoizeFetch(fetchFile),
      SourceMapConsumer: SourceMapConsumer,
      readErrorStack: readErrorStack,
      indent: indent,
      onFailure: onFailure
    });
    errorRemappingCache.set(error, stackRemappingPromise);
    return stackToString(stack, {
      error: error,
      indent: indent
    });
  };

  var getErrorOriginalStackString = _async$3(function (error) {
    var _exit = false;

    var _ref2 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref2$onFailure = _ref2.onFailure,
        onFailure = _ref2$onFailure === void 0 ? function (message) {
      console.warn(message);
    } : _ref2$onFailure;

    if (onFailure) {
      var remapFailureCallbackArray = errorRemapFailureCallbackMap.get(error);

      if (remapFailureCallbackArray) {
        errorRemapFailureCallbackMap.set(error, [].concat(_toConsumableArray(remapFailureCallbackArray), [onFailure]));
      } else {
        errorRemapFailureCallbackMap.set(error, [onFailure]);
      }
    } // ensure Error.prepareStackTrace gets triggered by reading error.stack now


    var stack = error.stack;
    var promise = errorRemappingCache.get(error);
    return _invoke$2(function () {
      if (promise) {
        return _catch$1(function () {
          return _await$3(promise, function (originalCallsites) {
            errorRemapFailureCallbackMap.get(error);
            var firstCall = originalCallsites[0];

            if (firstCall) {
              Object.assign(error, {
                filename: firstCall.getFileName(),
                lineno: firstCall.getLineNumber(),
                columnno: firstCall.getColumnNumber()
              });
            }

            _exit = true;
            return stackToString(originalCallsites, {
              error: error,
              indent: indent
            });
          });
        }, function (e) {
          var _createDetailedMessag;

          onFailure(logger.createDetailedMessage("error while computing original stack.", (_createDetailedMessag = {}, _defineProperty(_createDetailedMessag, "stack from error while computing", readErrorStack(e)), _defineProperty(_createDetailedMessag, "stack from error to remap", stack), _createDetailedMessag)));
          _exit = true;
          return stack;
        });
      }
    }, function (_result) {
      return _exit ? _result : stack;
    });
  });

  install();
  return {
    getErrorOriginalStackString: getErrorOriginalStackString,
    uninstall: uninstall
  };
};

var memoizeFetch = function memoizeFetch(fetchUrl) {
  var urlCache = {};
  return _async$3(function (url) {
    if (url in urlCache) {
      return urlCache[url];
    }

    var responsePromise = fetchUrl(url);
    urlCache[url] = responsePromise;
    return responsePromise;
  });
};

var _require = require$1("source-map"),
    SourceMapConsumer = _require.SourceMapConsumer;

var installNodeErrorStackRemapping = function installNodeErrorStackRemapping(_ref) {
  var projectDirectoryUrl = _ref.projectDirectoryUrl,
      options = _objectWithoutProperties(_ref, ["projectDirectoryUrl"]);

  return installErrorStackRemapping(_objectSpread({
    SourceMapConsumer: SourceMapConsumer,
    fetchFile: fetchUrl,
    resolveFile: function resolveFile(specifier) {
      var importer = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : projectDirectoryUrl;
      return util.ensureWindowsDriveLetter(util.resolveUrl(specifier, importer), importer);
    }
  }, options));
};

// eslint-disable-next-line consistent-return
var arrayWithHoles = (function (arr) {
  if (Array.isArray(arr)) return arr;
});

var iterableToArrayLimit = (function (arr, i) {
  // this is an expanded form of \`for...of\` that properly supports abrupt completions of
  // iterators etc. variable names have been minimised to reduce the size of this massive
  // helper. sometimes spec compliance is annoying :(
  //
  // _n = _iteratorNormalCompletion
  // _d = _didIteratorError
  // _e = _iteratorError
  // _i = _iterator
  // _s = _step
  if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return;
  var _arr = [];
  var _n = true;
  var _d = false;

  var _e;

  var _i = arr[Symbol.iterator]();

  var _s;

  try {
    for (; !(_n = (_s = _i.next()).done); _n = true) {
      _arr.push(_s.value);

      if (i && _arr.length === i) break;
    }
  } catch (err) {
    _d = true;
    _e = err;
  } finally {
    try {
      if (!_n && _i.return !== null) _i.return();
    } finally {
      if (_d) throw _e;
    }
  } // eslint-disable-next-line consistent-return


  return _arr;
});

var nonIterableRest = (function () {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
});

var _slicedToArray = (function (arr, i) {
  return arrayWithHoles(arr) || iterableToArrayLimit(arr, i) || unsupportedIterableToArray(arr, i) || nonIterableRest();
});

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

var fetchSource = function fetchSource(url) {
  var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
      executionId = _ref.executionId;

  return fetchUrl(url, {
    ignoreHttpsError: true,
    headers: _objectSpread({}, executionId ? {
      "x-jsenv-execution-id": executionId
    } : {})
  });
};

var COMPILE_ID_OTHERWISE = "otherwise";

var computeCompileIdFromGroupId = function computeCompileIdFromGroupId(_ref) {
  var groupId = _ref.groupId,
      groupMap = _ref.groupMap;

  if (typeof groupId === "undefined") {
    if (COMPILE_ID_OTHERWISE in groupMap) return COMPILE_ID_OTHERWISE;
    var keys = Object.keys(groupMap);
    if (keys.length === 1) return keys[0];
    throw new Error(createUnexpectedGroupIdMessage({
      groupMap: groupMap
    }));
  }

  if (groupId in groupMap === false) throw new Error(createUnexpectedGroupIdMessage({
    groupId: groupId,
    groupMap: groupMap
  }));
  return groupId;
};

var createUnexpectedGroupIdMessage = function createUnexpectedGroupIdMessage(_ref2) {
  var _createDetailedMessag;

  var compileId = _ref2.compileId,
      groupMap = _ref2.groupMap;
  return logger.createDetailedMessage("unexpected groupId.", (_createDetailedMessag = {}, _defineProperty(_createDetailedMessag, "expected compiled id", Object.keys(groupMap)), _defineProperty(_createDetailedMessag, "received compile id", compileId), _createDetailedMessag));
};

var detectNode = function detectNode() {
  return {
    name: "node",
    version: process.version.slice(1)
  };
};

var valueToVersion = function valueToVersion(value) {
  if (typeof value === "number") {
    return numberToVersion(value);
  }

  if (typeof value === "string") {
    return stringToVersion(value);
  }

  throw new TypeError(createValueErrorMessage({
    version: value
  }));
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

var createValueErrorMessage = function createValueErrorMessage(_ref) {
  var value = _ref.value;
  return "value must be a number or a string.\nvalue: ".concat(value);
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
    var runtimeCompatMap = groupMap[compileIdCandidate].runtimeCompatMap;

    if (name in runtimeCompatMap === false) {
      return false;
    }

    var versionForGroup = runtimeCompatMap[name];
    var highestVersion = findHighestVersion(version, versionForGroup);
    return highestVersion === version;
  });
};

var resolveNodeGroup = function resolveNodeGroup(groupMap) {
  return resolveGroup(detectNode(), groupMap);
};

/*
* SJS 6.7.1
* Minimal SystemJS Build
*/
(function () {
  function errMsg(errCode, msg) {
    return (msg || "") + " (SystemJS https://git.io/JvFET#" + errCode + ")";
  }

  var hasSymbol = typeof Symbol !== 'undefined';
  var hasSelf = typeof self !== 'undefined';
  var hasDocument = typeof document !== 'undefined';
  var envGlobal = hasSelf ? self : global;
  var baseUrl;

  if (hasDocument) {
    var baseEl = document.querySelector('base[href]');
    if (baseEl) baseUrl = baseEl.href;
  }

  if (!baseUrl && typeof location !== 'undefined') {
    baseUrl = location.href.split('#')[0].split('?')[0];
    var lastSepIndex = baseUrl.lastIndexOf('/');
    if (lastSepIndex !== -1) baseUrl = baseUrl.slice(0, lastSepIndex + 1);
  }

  var backslashRegEx = /\\/g;

  function resolveIfNotPlainOrUrl(relUrl, parentUrl) {
    if (relUrl.indexOf('\\') !== -1) relUrl = relUrl.replace(backslashRegEx, '/'); // protocol-relative

    if (relUrl[0] === '/' && relUrl[1] === '/') {
      return parentUrl.slice(0, parentUrl.indexOf(':') + 1) + relUrl;
    } // relative-url
    else if (relUrl[0] === '.' && (relUrl[1] === '/' || relUrl[1] === '.' && (relUrl[2] === '/' || relUrl.length === 2 && (relUrl += '/')) || relUrl.length === 1 && (relUrl += '/')) || relUrl[0] === '/') {
        var parentProtocol = parentUrl.slice(0, parentUrl.indexOf(':') + 1); // Disabled, but these cases will give inconsistent results for deep backtracking
        //if (parentUrl[parentProtocol.length] !== '/')
        //  throw Error('Cannot resolve');
        // read pathname from parent URL
        // pathname taken to be part after leading "/"

        var pathname;

        if (parentUrl[parentProtocol.length + 1] === '/') {
          // resolving to a :// so we need to read out the auth and host
          if (parentProtocol !== 'file:') {
            pathname = parentUrl.slice(parentProtocol.length + 2);
            pathname = pathname.slice(pathname.indexOf('/') + 1);
          } else {
            pathname = parentUrl.slice(8);
          }
        } else {
          // resolving to :/ so pathname is the /... part
          pathname = parentUrl.slice(parentProtocol.length + (parentUrl[parentProtocol.length] === '/'));
        }

        if (relUrl[0] === '/') return parentUrl.slice(0, parentUrl.length - pathname.length - 1) + relUrl; // join together and split for removal of .. and . segments
        // looping the string instead of anything fancy for perf reasons
        // '../../../../../z' resolved to 'x/y' is just 'z'

        var segmented = pathname.slice(0, pathname.lastIndexOf('/') + 1) + relUrl;
        var output = [];
        var segmentIndex = -1;

        for (var i = 0; i < segmented.length; i++) {
          // busy reading a segment - only terminate on '/'
          if (segmentIndex !== -1) {
            if (segmented[i] === '/') {
              output.push(segmented.slice(segmentIndex, i + 1));
              segmentIndex = -1;
            }
          } // new segment - check if it is relative
          else if (segmented[i] === '.') {
              // ../ segment
              if (segmented[i + 1] === '.' && (segmented[i + 2] === '/' || i + 2 === segmented.length)) {
                output.pop();
                i += 2;
              } // ./ segment
              else if (segmented[i + 1] === '/' || i + 1 === segmented.length) {
                  i += 1;
                } else {
                  // the start of a new segment as below
                  segmentIndex = i;
                }
            } // it is the start of a new segment
            else {
                segmentIndex = i;
              }
        } // finish reading out the last segment


        if (segmentIndex !== -1) output.push(segmented.slice(segmentIndex));
        return parentUrl.slice(0, parentUrl.length - pathname.length) + output.join('');
      }
  }
  /*
   * Import maps implementation
   *
   * To make lookups fast we pre-resolve the entire import map
   * and then match based on backtracked hash lookups
   *
   */


  function resolveUrl(relUrl, parentUrl) {
    return resolveIfNotPlainOrUrl(relUrl, parentUrl) || (relUrl.indexOf(':') !== -1 ? relUrl : resolveIfNotPlainOrUrl('./' + relUrl, parentUrl));
  }

  function resolveAndComposePackages(packages, outPackages, baseUrl, parentMap, parentUrl) {
    for (var p in packages) {
      var resolvedLhs = resolveIfNotPlainOrUrl(p, baseUrl) || p;
      var rhs = packages[p]; // package fallbacks not currently supported

      if (typeof rhs !== 'string') continue;
      var mapped = resolveImportMap(parentMap, resolveIfNotPlainOrUrl(rhs, baseUrl) || rhs, parentUrl);

      if (!mapped) {
        targetWarning('W1', p, rhs);
      } else outPackages[resolvedLhs] = mapped;
    }
  }

  function resolveAndComposeImportMap(json, baseUrl, outMap) {
    if (json.imports) resolveAndComposePackages(json.imports, outMap.imports, baseUrl, outMap, null);
    var u;

    for (u in json.scopes || {}) {
      var resolvedScope = resolveUrl(u, baseUrl);
      resolveAndComposePackages(json.scopes[u], outMap.scopes[resolvedScope] || (outMap.scopes[resolvedScope] = {}), baseUrl, outMap, resolvedScope);
    }

    for (u in json.depcache || {}) {
      outMap.depcache[resolveUrl(u, baseUrl)] = json.depcache[u];
    }

    for (u in json.integrity || {}) {
      outMap.integrity[resolveUrl(u, baseUrl)] = json.integrity[u];
    }
  }

  function getMatch(path, matchObj) {
    if (matchObj[path]) return path;
    var sepIndex = path.length;

    do {
      var segment = path.slice(0, sepIndex + 1);
      if (segment in matchObj) return segment;
    } while ((sepIndex = path.lastIndexOf('/', sepIndex - 1)) !== -1);
  }

  function applyPackages(id, packages) {
    var pkgName = getMatch(id, packages);

    if (pkgName) {
      var pkg = packages[pkgName];
      if (pkg === null) return;

      if (id.length > pkgName.length && pkg[pkg.length - 1] !== '/') {
        targetWarning('W2', pkgName, pkg);
      } else return pkg + id.slice(pkgName.length);
    }
  }

  function targetWarning(code, match, target, msg) {
    console.warn(errMsg(code, [target, match].join(', ')));
  }

  function resolveImportMap(importMap, resolvedOrPlain, parentUrl) {
    var scopes = importMap.scopes;
    var scopeUrl = parentUrl && getMatch(parentUrl, scopes);

    while (scopeUrl) {
      var packageResolution = applyPackages(resolvedOrPlain, scopes[scopeUrl]);
      if (packageResolution) return packageResolution;
      scopeUrl = getMatch(scopeUrl.slice(0, scopeUrl.lastIndexOf('/')), scopes);
    }

    return applyPackages(resolvedOrPlain, importMap.imports) || resolvedOrPlain.indexOf(':') !== -1 && resolvedOrPlain;
  }
  /*
   * SystemJS Core
   *
   * Provides
   * - System.import
   * - System.register support for
   *     live bindings, function hoisting through circular references,
   *     reexports, dynamic import, import.meta.url, top-level await
   * - System.getRegister to get the registration
   * - Symbol.toStringTag support in Module objects
   * - Hookable System.createContext to customize import.meta
   * - System.onload(err, id, deps) handler for tracing / hot-reloading
   *
   * Core comes with no System.prototype.resolve or
   * System.prototype.instantiate implementations
   */


  var toStringTag = hasSymbol && Symbol.toStringTag;
  var REGISTRY = hasSymbol ? Symbol() : '@';

  function SystemJS() {
    this[REGISTRY] = {};
  }

  var systemJSPrototype = SystemJS.prototype;

  systemJSPrototype.import = function (id, parentUrl) {
    var loader = this;
    return Promise.resolve(loader.prepareImport()).then(function () {
      return loader.resolve(id, parentUrl);
    }).then(function (id) {
      var load = getOrCreateLoad(loader, id);
      return load.C || topLevelLoad(loader, load);
    });
  }; // Hookable createContext function -> allowing eg custom import meta


  systemJSPrototype.createContext = function (parentId) {
    var loader = this;
    return {
      url: parentId,
      resolve: function resolve(id, parentUrl) {
        return Promise.resolve(loader.resolve(id, parentUrl || parentId));
      }
    };
  };

  function loadToId(load) {
    return load.id;
  }

  function triggerOnload(loader, load, err, isErrSource) {
    loader.onload(err, load.id, load.d && load.d.map(loadToId), !!isErrSource);
    if (err) throw err;
  }

  var lastRegister;

  systemJSPrototype.register = function (deps, declare) {
    lastRegister = [deps, declare];
  };
  /*
   * getRegister provides the last anonymous System.register call
   */


  systemJSPrototype.getRegister = function () {
    var _lastRegister = lastRegister;
    lastRegister = undefined;
    return _lastRegister;
  };

  function getOrCreateLoad(loader, id, firstParentUrl) {
    var load = loader[REGISTRY][id];
    if (load) return load;
    var importerSetters = [];
    var ns = Object.create(null);
    if (toStringTag) Object.defineProperty(ns, toStringTag, {
      value: 'Module'
    });
    var instantiatePromise = Promise.resolve().then(function () {
      return loader.instantiate(id, firstParentUrl);
    }).then(function (registration) {
      if (!registration) throw Error(errMsg(2, id));

      function _export(name, value) {
        // note if we have hoisted exports (including reexports)
        load.h = true;
        var changed = false;

        if (typeof name === 'string') {
          if (!(name in ns) || ns[name] !== value) {
            ns[name] = value;
            changed = true;
          }
        } else {
          for (var p in name) {
            var value = name[p];

            if (!(p in ns) || ns[p] !== value) {
              ns[p] = value;
              changed = true;
            }
          }

          if (name.__esModule) {
            ns.__esModule = name.__esModule;
          }
        }

        if (changed) for (var i = 0; i < importerSetters.length; i++) {
          var setter = importerSetters[i];
          if (setter) setter(ns);
        }
        return value;
      }

      var declared = registration[1](_export, registration[1].length === 2 ? {
        import: function _import(importId) {
          return loader.import(importId, id);
        },
        meta: loader.createContext(id)
      } : undefined);

      load.e = declared.execute || function () {};

      return [registration[0], declared.setters || []];
    });
    var linkPromise = instantiatePromise.then(function (instantiation) {
      return Promise.all(instantiation[0].map(function (dep, i) {
        var setter = instantiation[1][i];
        return Promise.resolve(loader.resolve(dep, id)).then(function (depId) {
          var depLoad = getOrCreateLoad(loader, depId, id); // depLoad.I may be undefined for already-evaluated

          return Promise.resolve(depLoad.I).then(function () {
            if (setter) {
              depLoad.i.push(setter); // only run early setters when there are hoisted exports of that module
              // the timing works here as pending hoisted export calls will trigger through importerSetters

              if (depLoad.h || !depLoad.I) setter(depLoad.n);
            }

            return depLoad;
          });
        });
      })).then(function (depLoads) {
        load.d = depLoads;
      }, !true);
    });
    linkPromise.catch(function (err) {
      load.e = null;
      load.er = err;
    }); // Capital letter = a promise function

    return load = loader[REGISTRY][id] = {
      id: id,
      // importerSetters, the setters functions registered to this dependency
      // we retain this to add more later
      i: importerSetters,
      // module namespace object
      n: ns,
      // instantiate
      I: instantiatePromise,
      // link
      L: linkPromise,
      // whether it has hoisted exports
      h: false,
      // On instantiate completion we have populated:
      // dependency load records
      d: undefined,
      // execution function
      // set to NULL immediately after execution (or on any failure) to indicate execution has happened
      // in such a case, C should be used, and E, I, L will be emptied
      e: undefined,
      // On execution we have populated:
      // the execution error if any
      er: undefined,
      // in the case of TLA, the execution promise
      E: undefined,
      // On execution, L, I, E cleared
      // Promise for top-level completion
      C: undefined
    };
  }

  function instantiateAll(loader, load, loaded) {
    if (!loaded[load.id]) {
      loaded[load.id] = true; // load.L may be undefined for already-instantiated

      return Promise.resolve(load.L).then(function () {
        return Promise.all(load.d.map(function (dep) {
          return instantiateAll(loader, dep, loaded);
        }));
      });
    }
  }

  function topLevelLoad(loader, load) {
    return load.C = instantiateAll(loader, load, {}).then(function () {
      return postOrderExec(loader, load, {});
    }).then(function () {
      return load.n;
    });
  } // the closest we can get to call(undefined)


  var nullContext = Object.freeze(Object.create(null)); // returns a promise if and only if a top-level await subgraph
  // throws on sync errors

  function postOrderExec(loader, load, seen) {
    if (seen[load.id]) return;
    seen[load.id] = true;

    if (!load.e) {
      if (load.er) throw load.er;
      if (load.E) return load.E;
      return;
    } // deps execute first, unless circular


    var depLoadPromises;
    load.d.forEach(function (depLoad) {
      try {
        var depLoadPromise = postOrderExec(loader, depLoad, seen);
        if (depLoadPromise) (depLoadPromises = depLoadPromises || []).push(depLoadPromise);
      } catch (err) {
        load.e = null;
        load.er = err;
        throw err;
      }
    });
    if (depLoadPromises) return Promise.all(depLoadPromises).then(doExec, function (err) {
      load.e = null;
      load.er = err;
      throw err;
    });
    return doExec();

    function doExec() {
      try {
        var execPromise = load.e.call(nullContext);

        if (execPromise) {
          execPromise = execPromise.then(function () {
            load.C = load.n;
            load.E = null; // indicates completion

            if (!true) ;
          }, function (err) {
            load.er = err;
            load.E = null;
            if (!true) ;else throw err;
          });
          return load.E = load.E || execPromise;
        } // (should be a promise, but a minify optimization to leave out Promise.resolve)


        load.C = load.n;
        if (!true) ;
      } catch (err) {
        load.er = err;
        throw err;
      } finally {
        load.L = load.I = undefined;
        load.e = null;
      }
    }
  }

  envGlobal.System = new SystemJS();
  /*
   * SystemJS browser attachments for script and import map processing
   */

  var importMapPromise = Promise.resolve();
  var importMap = {
    imports: {},
    scopes: {},
    depcache: {},
    integrity: {}
  }; // Scripts are processed immediately, on the first System.import, and on DOMReady.
  // Import map scripts are processed only once (by being marked) and in order for each phase.
  // This is to avoid using DOM mutation observers in core, although that would be an alternative.

  var processFirst = hasDocument;

  systemJSPrototype.prepareImport = function (doProcessScripts) {
    if (processFirst || doProcessScripts) {
      processScripts();
      processFirst = false;
    }

    return importMapPromise;
  };

  if (hasDocument) {
    processScripts();
    window.addEventListener('DOMContentLoaded', processScripts);
  }

  function processScripts() {
    [].forEach.call(document.querySelectorAll('script'), function (script) {
      if (script.sp) // sp marker = systemjs processed
        return; // TODO: deprecate systemjs-module in next major now that we have auto import

      if (script.type === 'systemjs-module') {
        script.sp = true;
        if (!script.src) return;
        System.import(script.src.slice(0, 7) === 'import:' ? script.src.slice(7) : resolveUrl(script.src, baseUrl));
      } else if (script.type === 'systemjs-importmap') {
        script.sp = true;
        var fetchPromise = script.src ? fetch(script.src, {
          integrity: script.integrity
        }).then(function (res) {
          return res.text();
        }) : script.innerHTML;
        importMapPromise = importMapPromise.then(function () {
          return fetchPromise;
        }).then(function (text) {
          extendImportMap(importMap, text, script.src || baseUrl);
        });
      }
    });
  }

  function extendImportMap(importMap, newMapText, newMapUrl) {
    try {
      var newMap = JSON.parse(newMapText);
    } catch (err) {
      throw Error(errMsg(1));
    }

    resolveAndComposeImportMap(newMap, newMapUrl, importMap);
  }
  /*
   * Script instantiation loading
   */


  if (hasDocument) {
    window.addEventListener('error', function (evt) {
      lastWindowErrorUrl = evt.filename;
      lastWindowError = evt.error;
    });
    var baseOrigin = location.origin;
  }

  systemJSPrototype.createScript = function (url) {
    var script = document.createElement('script');
    script.async = true; // Only add cross origin for actual cross origin
    // this is because Safari triggers for all
    // - https://bugs.webkit.org/show_bug.cgi?id=171566

    if (url.indexOf(baseOrigin + '/')) script.crossOrigin = 'anonymous';
    var integrity = importMap.integrity[url];
    if (integrity) script.integrity = integrity;
    script.src = url;
    return script;
  }; // Auto imports -> script tags can be inlined directly for load phase


  var lastAutoImportUrl, lastAutoImportDeps, lastAutoImportTimeout;
  var autoImportCandidates = {};
  var systemRegister = systemJSPrototype.register;

  systemJSPrototype.register = function (deps, declare) {
    if (hasDocument && document.readyState === 'loading' && typeof deps !== 'string') {
      var scripts = document.querySelectorAll('script[src]');
      var lastScript = scripts[scripts.length - 1];

      if (lastScript) {
        lastAutoImportUrl = lastScript.src;
        lastAutoImportDeps = deps; // if this is already a System load, then the instantiate has already begun
        // so this re-import has no consequence

        var loader = this;
        lastAutoImportTimeout = setTimeout(function () {
          autoImportCandidates[lastScript.src] = [deps, declare];
          loader.import(lastScript.src);
        });
      }
    } else {
      lastAutoImportDeps = undefined;
    }

    return systemRegister.call(this, deps, declare);
  };

  var lastWindowErrorUrl, lastWindowError;

  systemJSPrototype.instantiate = function (url, firstParentUrl) {
    var autoImportRegistration = autoImportCandidates[url];

    if (autoImportRegistration) {
      delete autoImportCandidates[url];
      return autoImportRegistration;
    }

    var loader = this;
    return new Promise(function (resolve, reject) {
      var script = systemJSPrototype.createScript(url);
      script.addEventListener('error', function () {
        reject(Error(errMsg(3, [url, firstParentUrl].join(', '))));
      });
      script.addEventListener('load', function () {
        document.head.removeChild(script); // Note that if an error occurs that isn't caught by this if statement,
        // that getRegister will return null and a "did not instantiate" error will be thrown.

        if (lastWindowErrorUrl === url) {
          reject(lastWindowError);
        } else {
          var register = loader.getRegister(); // Clear any auto import registration for dynamic import scripts during load

          if (register && register[0] === lastAutoImportDeps) clearTimeout(lastAutoImportTimeout);
          resolve(register);
        }
      });
      document.head.appendChild(script);
    });
  };
  /*
   * Fetch loader, sets up shouldFetch and fetch hooks
   */


  systemJSPrototype.shouldFetch = function () {
    return false;
  };

  if (typeof fetch !== 'undefined') systemJSPrototype.fetch = fetch;
  var instantiate = systemJSPrototype.instantiate;
  var jsContentTypeRegEx = /^(text|application)\/(x-)?javascript(;|$)/;

  systemJSPrototype.instantiate = function (url, parent) {
    var loader = this;
    if (!this.shouldFetch(url)) return instantiate.apply(this, arguments);
    return this.fetch(url, {
      credentials: 'same-origin',
      integrity: importMap.integrity[url]
    }).then(function (res) {
      if (!res.ok) throw Error(errMsg(7, [res.status, res.statusText, url, parent].join(', ')));
      var contentType = res.headers.get('content-type');
      if (!contentType || !jsContentTypeRegEx.test(contentType)) throw Error(errMsg(4, contentType));
      return res.text().then(function (source) {
        (0, eval)(source);
        return loader.getRegister();
      });
    });
  };

  systemJSPrototype.resolve = function (id, parentUrl) {
    parentUrl = parentUrl || !true || baseUrl;
    return resolveImportMap(importMap, resolveIfNotPlainOrUrl(id, parentUrl) || id, parentUrl) || throwUnresolved(id, parentUrl);
  };

  function throwUnresolved(id, parentUrl) {
    throw Error(errMsg(8, [id, parentUrl].join(', ')));
  }

  var systemInstantiate = systemJSPrototype.instantiate;

  systemJSPrototype.instantiate = function (url, firstParentUrl) {
    var preloads = importMap.depcache[url];

    if (preloads) {
      for (var i = 0; i < preloads.length; i++) {
        getOrCreateLoad(this, this.resolve(preloads[i], url), url);
      }
    }

    return systemInstantiate.call(this, url, firstParentUrl);
  };
  /*
   * Supports loading System.register in workers
   */


  if (hasSelf && typeof importScripts === 'function') systemJSPrototype.instantiate = function (url) {
    var loader = this;
    return Promise.resolve().then(function () {
      importScripts(url);
      return loader.getRegister();
    });
  };
})();

function _await$4(value, then, direct) {
  if (direct) {
    return then ? then(value) : value;
  }

  if (!value || !value.then) {
    value = Promise.resolve(value);
  }

  return then ? value.then(then) : value;
}

function _catch$2(body, recover) {
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

function _invoke$3(body, then) {
  var result = body();

  if (result && result.then) {
    return result.then(then);
  }

  return then(result);
}

function _continue$1(value, then) {
  return value && value.then ? value.then(then) : then(value);
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

var fromFunctionReturningNamespace = function fromFunctionReturningNamespace(fn, data) {
  return fromFunctionReturningRegisteredModule(function () {
    // should we compute the namespace here
    // or as it is done below, defer to execute ?
    // I think defer to execute is better
    return [[], function (_export) {
      return {
        execute: function execute() {
          var namespace = fn();

          _export(namespace);
        }
      };
    }];
  }, data);
};

var fromFunctionReturningRegisteredModule = function fromFunctionReturningRegisteredModule(fn, data) {
  try {
    return fn();
  } catch (error) {
    if (error.name === "SyntaxError") {
      throw new Error(logger.createDetailedMessage("Syntax error in module.", _objectSpread({
        "syntax error stack": error.stack
      }, getModuleDetails(data))));
    }

    throw new Error(logger.createDetailedMessage("Module instantiation error.", _objectSpread(_defineProperty({}, "instantiation error stack", error.stack), getModuleDetails(data))));
  }
};

var fromUrl = _async$4(function (_ref) {
  var url = _ref.url,
      importerUrl = _ref.importerUrl,
      fetchSource = _ref.fetchSource,
      instantiateJavaScript = _ref.instantiateJavaScript,
      compileServerOrigin = _ref.compileServerOrigin,
      outDirectoryRelativeUrl = _ref.outDirectoryRelativeUrl;
  var moduleResponse;
  return _continue$1(_catch$2(function () {
    return _await$4(fetchSource(url, {
      importerUrl: importerUrl
    }), function (_fetchSource) {
      moduleResponse = _fetchSource;

      if (moduleResponse.status === 404) {
        throw new Error(logger.createDetailedMessage("Module file cannot be found.", getModuleDetails({
          url: url,
          importerUrl: importerUrl,
          compileServerOrigin: compileServerOrigin,
          outDirectoryRelativeUrl: outDirectoryRelativeUrl,
          notFound: true
        })));
      }
    });
  }, function (e) {
    e.code = "NETWORK_FAILURE";
    throw e;
  }), function (_result) {
    var contentType = moduleResponse.headers["content-type"] || "";
    return _invoke$3(function () {
      if (moduleResponse.status === 500 && contentType === "application/json") {
        return _await$4(moduleResponse.json(), function (bodyAsJson) {
          if (bodyAsJson.message && bodyAsJson.filename && "columnNumber" in bodyAsJson) {
            var error = new Error(logger.createDetailedMessage("Module file cannot be parsed.", _objectSpread(_defineProperty({}, "parsing error message", bodyAsJson.message), getModuleDetails({
              url: url,
              importerUrl: importerUrl,
              compileServerOrigin: compileServerOrigin,
              outDirectoryRelativeUrl: outDirectoryRelativeUrl
            }))));
            error.parsingError = bodyAsJson;
            throw error;
          }
        });
      }
    }, function (_result2) {
      var _exit3 = false;

      if (moduleResponse.status < 200 || moduleResponse.status >= 300) {
        var _objectSpread4;

        throw new Error(logger.createDetailedMessage("Module file response status is unexpected.", _objectSpread((_objectSpread4 = {}, _defineProperty(_objectSpread4, "status", moduleResponse.status), _defineProperty(_objectSpread4, "allowed status", "200 to 299"), _defineProperty(_objectSpread4, "statusText", moduleResponse.statusText), _objectSpread4), getModuleDetails({
          url: url,
          importerUrl: importerUrl,
          compileServerOrigin: compileServerOrigin,
          outDirectoryRelativeUrl: outDirectoryRelativeUrl
        }))));
      } // don't forget to keep it close to https://github.com/systemjs/systemjs/blob/9a15cfd3b7a9fab261e1848b1b2fa343d73afedb/src/extras/module-types.js#L21
      // and in sync with loadModule in createJsenvRollupPlugin.js


      return _invoke$3(function () {
        if (contentType === "application/javascript" || contentType === "text/javascript") {
          return _await$4(moduleResponse.text(), function (bodyAsText) {
            _exit3 = true;
            return fromFunctionReturningRegisteredModule(function () {
              return instantiateJavaScript(bodyAsText, moduleResponse.url);
            }, {
              url: moduleResponse.url,
              importerUrl: importerUrl,
              compileServerOrigin: compileServerOrigin,
              outDirectoryRelativeUrl: outDirectoryRelativeUrl
            });
          });
        }
      }, function (_result3) {
        var _exit4 = false;
        if (_exit3) return _result3;
        return _invoke$3(function () {
          if (contentType === "application/json" || contentType === "application/importmap+json") {
            return _await$4(moduleResponse.json(), function (bodyAsJson) {
              _exit4 = true;
              return fromFunctionReturningNamespace(function () {
                return {
                  default: bodyAsJson
                };
              }, {
                url: moduleResponse.url,
                importerUrl: importerUrl,
                compileServerOrigin: compileServerOrigin,
                outDirectoryRelativeUrl: outDirectoryRelativeUrl
              });
            });
          }
        }, function (_result4) {
          if (_exit4) return _result4;

          if (contentTypeShouldBeReadAsText(contentType)) {
            return fromFunctionReturningNamespace(function () {
              return {
                default: moduleResponse.url
              };
            }, {
              url: moduleResponse.url,
              importerUrl: importerUrl,
              compileServerOrigin: compileServerOrigin,
              outDirectoryRelativeUrl: outDirectoryRelativeUrl
            });
          }

          if (contentType) ; else {
            console.warn("Module content-type is missing.", _objectSpread(_defineProperty({}, "allowed content-type", ["aplication/javascript", "application/json", "text/*"]), getModuleDetails({
              url: url,
              importerUrl: importerUrl,
              compileServerOrigin: compileServerOrigin,
              outDirectoryRelativeUrl: outDirectoryRelativeUrl
            })));
          }

          return fromFunctionReturningNamespace(function () {
            return {
              default: moduleResponse.url
            };
          }, {
            url: moduleResponse.url,
            importerUrl: importerUrl,
            compileServerOrigin: compileServerOrigin,
            outDirectoryRelativeUrl: outDirectoryRelativeUrl
          });
        });
      });
    });
  });
});

var contentTypeShouldBeReadAsText = function contentTypeShouldBeReadAsText(contentType) {
  if (contentType.startsWith("text/")) {
    return true;
  }

  if (contentType === "image/svg+xml") {
    return true;
  }

  return false;
}; // const textToBase64 =
//   typeof window === "object"
//     ? (text) => window.btoa(window.unescape(window.encodeURIComponent(text)))
//     : (text) => Buffer.from(text, "utf8").toString("base64")


var getModuleDetails = function getModuleDetails(_ref2) {
  var url = _ref2.url,
      importerUrl = _ref2.importerUrl,
      compileServerOrigin = _ref2.compileServerOrigin,
      outDirectoryRelativeUrl = _ref2.outDirectoryRelativeUrl,
      _ref2$notFound = _ref2.notFound,
      notFound = _ref2$notFound === void 0 ? false : _ref2$notFound;
  var relativeUrl = tryToFindProjectRelativeUrl(url, {
    compileServerOrigin: compileServerOrigin,
    outDirectoryRelativeUrl: outDirectoryRelativeUrl
  });
  var importerRelativeUrl = tryToFindProjectRelativeUrl(importerUrl, {
    compileServerOrigin: compileServerOrigin,
    outDirectoryRelativeUrl: outDirectoryRelativeUrl
  });
  var details = notFound ? _objectSpread(_objectSpread(_objectSpread({}, importerUrl ? _defineProperty({}, "import declared in", importerRelativeUrl || importerUrl) : {}), relativeUrl ? {
    file: relativeUrl
  } : {}), {}, _defineProperty({}, "file url", url)) : _objectSpread(_objectSpread({}, relativeUrl ? {
    file: relativeUrl
  } : {}), {}, _defineProperty({}, "file url", url), importerUrl ? _defineProperty({}, "imported by", importerRelativeUrl || importerUrl) : {});
  return details;
};

var tryToFindProjectRelativeUrl = function tryToFindProjectRelativeUrl(url, _ref5) {
  var compileServerOrigin = _ref5.compileServerOrigin,
      outDirectoryRelativeUrl = _ref5.outDirectoryRelativeUrl;

  if (!url) {
    return null;
  }

  if (!url.startsWith("".concat(compileServerOrigin, "/"))) {
    return null;
  }

  if (url === compileServerOrigin) {
    return null;
  }

  var afterOrigin = url.slice("".concat(compileServerOrigin, "/").length);

  if (!afterOrigin.startsWith(outDirectoryRelativeUrl)) {
    return null;
  }

  var afterCompileDirectory = afterOrigin.slice(outDirectoryRelativeUrl.length);
  var nextSlashIndex = afterCompileDirectory.indexOf("/");

  if (nextSlashIndex === -1) {
    return null;
  }

  var afterCompileId = afterCompileDirectory.slice(nextSlashIndex + 1);
  return afterCompileId;
};

var valueInstall = function valueInstall(object, name, value) {
  var has = (name in object);
  var previous = object[name];
  object[name] = value;
  return function () {
    if (has) {
      object[name] = previous;
    } else {
      delete object[name];
    }
  };
};

var NATIVE_NODE_MODULE_SPECIFIER_ARRAY = ["assert", "async_hooks", "buffer_ieee754", "buffer", "child_process", "cluster", "console", "constants", "crypto", "_debugger", "dgram", "dns", "domain", "events", "freelist", "fs", "fs/promises", "_http_agent", "_http_client", "_http_common", "_http_incoming", "_http_outgoing", "_http_server", "http", "http2", "https", "inspector", "_linklist", "module", "net", "node-inspect/lib/_inspect", "node-inspect/lib/internal/inspect_client", "node-inspect/lib/internal/inspect_repl", "os", "path", "perf_hooks", "process", "punycode", "querystring", "readline", "repl", "smalloc", "_stream_duplex", "_stream_transform", "_stream_wrap", "_stream_passthrough", "_stream_readable", "_stream_writable", "stream", "string_decoder", "sys", "timers", "_tls_common", "_tls_legacy", "_tls_wrap", "tls", "trace_events", "tty", "url", "util", "v8/tools/arguments", "v8/tools/codemap", "v8/tools/consarray", "v8/tools/csvparser", "v8/tools/logreader", "v8/tools/profile_view", "v8/tools/splaytree", "v8", "vm", "worker_threads", "zlib", // global is special
"global"];
var isNativeNodeModuleBareSpecifier = function isNativeNodeModuleBareSpecifier(specifier) {
  return NATIVE_NODE_MODULE_SPECIFIER_ARRAY.includes(specifier);
};

var evalSource = function evalSource(code, filePath) {
  var script = new vm.Script(code, {
    filename: filePath
  });
  return script.runInThisContext();
};

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

var GLOBAL_SPECIFIER = "global";
var createNodeSystem = function createNodeSystem() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      projectDirectoryUrl = _ref.projectDirectoryUrl,
      compileServerOrigin = _ref.compileServerOrigin,
      outDirectoryRelativeUrl = _ref.outDirectoryRelativeUrl,
      importMap$1 = _ref.importMap,
      importDefaultExtension = _ref.importDefaultExtension,
      fetchSource = _ref.fetchSource;

  if (typeof global.System === "undefined") {
    throw new Error("global.System is undefined");
  }

  var nodeSystem = new global.System.constructor();

  var _resolve = function resolve(specifier, importer) {
    if (specifier === GLOBAL_SPECIFIER) return specifier;
    if (isNativeNodeModuleBareSpecifier(specifier)) return specifier;
    return importMap.resolveImport({
      specifier: specifier,
      importer: importer,
      importMap: importMap$1,
      defaultExtension: importDefaultExtension
    });
  };

  nodeSystem.resolve = _resolve;
  nodeSystem.instantiate = _async$5(function (url, importerUrl) {
    if (url === GLOBAL_SPECIFIER) {
      return fromFunctionReturningNamespace(function () {
        return global;
      }, {
        url: url,
        importerUrl: importerUrl,
        compileServerOrigin: compileServerOrigin,
        outDirectoryRelativeUrl: outDirectoryRelativeUrl
      });
    }

    return isNativeNodeModuleBareSpecifier(url) ? fromFunctionReturningNamespace(function () {
      // eslint-disable-next-line import/no-dynamic-require
      var moduleExportsForNativeNodeModule = require$1(url);

      return moduleExportsToModuleNamespace(moduleExportsForNativeNodeModule);
    }, {
      url: url,
      importerUrl: importerUrl,
      compileServerOrigin: compileServerOrigin,
      outDirectoryRelativeUrl: outDirectoryRelativeUrl
    }) : fromUrl({
      url: url,
      importerUrl: importerUrl,
      fetchSource: fetchSource,
      instantiateJavaScript: function instantiateJavaScript(responseBody, responseUrl) {
        var uninstallSystemGlobal = valueInstall(global, "System", nodeSystem);

        try {
          evalSource(responseBody, responseUrlToSourceUrl(responseUrl, {
            projectDirectoryUrl: projectDirectoryUrl,
            compileServerOrigin: compileServerOrigin
          }));
        } finally {
          uninstallSystemGlobal();
        }

        return nodeSystem.getRegister();
      },
      outDirectoryRelativeUrl: outDirectoryRelativeUrl,
      compileServerOrigin: compileServerOrigin
    });
  }); // https://github.com/systemjs/systemjs/blob/master/docs/hooks.md#createcontexturl---object

  nodeSystem.createContext = function (url) {
    var originalUrl = urlToOriginalUrl(url, {
      projectDirectoryUrl: projectDirectoryUrl,
      outDirectoryRelativeUrl: outDirectoryRelativeUrl,
      compileServerOrigin: compileServerOrigin
    });
    return {
      url: originalUrl,
      resolve: function resolve(specifier) {
        var urlResolved = _resolve(specifier, url);

        return urlToOriginalUrl(urlResolved, {
          projectDirectoryUrl: projectDirectoryUrl,
          outDirectoryRelativeUrl: outDirectoryRelativeUrl,
          compileServerOrigin: compileServerOrigin
        });
      }
    };
  };

  return nodeSystem;
};

var responseUrlToSourceUrl = function responseUrlToSourceUrl(responseUrl, _ref2) {
  var compileServerOrigin = _ref2.compileServerOrigin,
      projectDirectoryUrl = _ref2.projectDirectoryUrl;

  if (responseUrl.startsWith("file://")) {
    return util.urlToFileSystemPath(responseUrl);
  } // compileServerOrigin is optionnal
  // because we can also create a node system and use it to import a build
  // from filesystem. In that case there is no compileServerOrigin


  if (compileServerOrigin && responseUrl.startsWith("".concat(compileServerOrigin, "/"))) {
    var afterOrigin = responseUrl.slice("".concat(compileServerOrigin, "/").length);
    var fileUrl = util.resolveUrl(afterOrigin, projectDirectoryUrl);
    return util.urlToFileSystemPath(fileUrl);
  }

  return responseUrl;
};

var urlToOriginalUrl = function urlToOriginalUrl(url, _ref3) {
  var projectDirectoryUrl = _ref3.projectDirectoryUrl,
      outDirectoryRelativeUrl = _ref3.outDirectoryRelativeUrl,
      compileServerOrigin = _ref3.compileServerOrigin;

  if (!url.startsWith("".concat(compileServerOrigin, "/"))) {
    return url;
  }

  if (url === compileServerOrigin) {
    return url;
  }

  var afterOrigin = url.slice("".concat(compileServerOrigin, "/").length);

  if (!afterOrigin.startsWith(outDirectoryRelativeUrl)) {
    return url;
  }

  var afterCompileDirectory = afterOrigin.slice(outDirectoryRelativeUrl.length);
  var nextSlashIndex = afterCompileDirectory.indexOf("/");

  if (nextSlashIndex === -1) {
    return url;
  }

  var afterCompileId = afterCompileDirectory.slice(nextSlashIndex + 1);
  return util.resolveUrl(afterCompileId, projectDirectoryUrl);
};

var moduleExportsToModuleNamespace = function moduleExportsToModuleNamespace(moduleExports) {
  // keep in mind moduleExports can be a function (like require('stream'))
  if (_typeof(moduleExports) === "object" && "default" in moduleExports) {
    return moduleExports;
  }

  return _objectSpread(_objectSpread({}, moduleExports), {}, {
    default: moduleExports
  });
};

function _await$5(value, then, direct) {
  if (direct) {
    return then ? then(value) : value;
  }

  if (!value || !value.then) {
    value = Promise.resolve(value);
  }

  return then ? value.then(then) : value;
}

var memoizedCreateNodeSystem = memoize(createNodeSystem);

function _invoke$4(body, then) {
  var result = body();

  if (result && result.then) {
    return result.then(then);
  }

  return then(result);
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

function _catch$3(body, recover) {
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

function _continue$2(value, then) {
  return value && value.then ? value.then(then) : then(value);
}

function _rethrow(thrown, value) {
  if (thrown) throw value;
  return value;
}

function _finallyRethrows(body, finalizer) {
  try {
    var result = body();
  } catch (e) {
    return finalizer(true, e);
  }

  if (result && result.then) {
    return result.then(finalizer.bind(null, false), finalizer.bind(null, true));
  }

  return finalizer(false, result);
}

var createNodeRuntime = _async$6(function (_ref) {
  var projectDirectoryUrl = _ref.projectDirectoryUrl,
      compileServerOrigin = _ref.compileServerOrigin,
      outDirectoryRelativeUrl = _ref.outDirectoryRelativeUrl;
  var outDirectoryUrl = "".concat(projectDirectoryUrl).concat(outDirectoryRelativeUrl);
  var groupMapUrl = String(new URL("groupMap.json", outDirectoryUrl));
  var envUrl = String(new URL("env.json", outDirectoryUrl));
  return _await$5(Promise.all([importJson(groupMapUrl), importJson(envUrl)]), function (_ref2) {
    var _ref3 = _slicedToArray(_ref2, 2),
        groupMap = _ref3[0],
        _ref3$ = _ref3[1],
        importMapFileRelativeUrl = _ref3$.importMapFileRelativeUrl,
        importDefaultExtension = _ref3$.importDefaultExtension;

    var compileId = computeCompileIdFromGroupId({
      groupId: resolveNodeGroup(groupMap),
      groupMap: groupMap
    });
    var compileDirectoryRelativeUrl = "".concat(outDirectoryRelativeUrl).concat(compileId, "/");
    var importMap$1;
    return _invoke$4(function () {
      if (importMapFileRelativeUrl) {
        var importmapFileUrl = "".concat(compileServerOrigin, "/").concat(compileDirectoryRelativeUrl).concat(importMapFileRelativeUrl);
        return _await$5(fetchUrl(importmapFileUrl), function (importmapFileResponse) {
          var _temp = importmapFileResponse.status === 404;

          return _await$5(_temp ? {} : importmapFileResponse.json(), function (importmap) {
            var importmapNormalized = importMap.normalizeImportMap(importmap, importmapFileUrl);
            importMap$1 = importmapNormalized;
          }, _temp);
        });
      }
    }, function () {
      var importFile = _async$6(function (specifier) {
        return _await$5(memoizedCreateNodeSystem({
          projectDirectoryUrl: projectDirectoryUrl,
          compileServerOrigin: compileServerOrigin,
          outDirectoryRelativeUrl: outDirectoryRelativeUrl,
          importMap: importMap$1,
          importDefaultExtension: importDefaultExtension,
          fetchSource: fetchSource
        }), function (nodeSystem) {
          return makePromiseKeepNodeProcessAlive(nodeSystem.import(specifier));
        });
      });

      var executeFile = _async$6(function (specifier) {
        var _ref4 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
            _ref4$errorExposureIn = _ref4.errorExposureInConsole,
            errorExposureInConsole = _ref4$errorExposureIn === void 0 ? true : _ref4$errorExposureIn,
            _ref4$errorTransform = _ref4.errorTransform,
            errorTransform = _ref4$errorTransform === void 0 ? function (error) {
          return error;
        } : _ref4$errorTransform;

        return _await$5(memoizedCreateNodeSystem({
          projectDirectoryUrl: projectDirectoryUrl,
          compileServerOrigin: compileServerOrigin,
          outDirectoryRelativeUrl: outDirectoryRelativeUrl,
          importMap: importMap$1,
          importDefaultExtension: importDefaultExtension,
          fetchSource: fetchSource
        }), function (nodeSystem) {
          return _catch$3(function () {
            return _await$5(makePromiseKeepNodeProcessAlive(nodeSystem.import(specifier)), function (namespace) {
              return {
                status: "completed",
                namespace: namespace,
                coverageMap: readCoverage()
              };
            });
          }, function (error) {
            var transformedError;
            return _continue$2(_catch$3(function () {
              return _await$5(errorTransform(error), function (_errorTransform) {
                transformedError = _errorTransform;
              });
            }, function () {
              transformedError = error;
            }), function () {
              if (errorExposureInConsole) console.error(transformedError);
              return {
                status: "errored",
                exceptionSource: unevalException(transformedError),
                coverageMap: readCoverage()
              };
            });
          });
        });
      });

      return {
        compileDirectoryRelativeUrl: compileDirectoryRelativeUrl,
        importFile: importFile,
        executeFile: executeFile
      };
    });
  });
});

var importJson = _async$6(function (url) {
  return _await$5(fetchSource(url), function (response) {
    return _await$5(response.json());
  });
});

var unevalException = function unevalException(value) {
  return _uneval.uneval(value);
};

var readCoverage = function readCoverage() {
  return global.__coverage__;
};

var makePromiseKeepNodeProcessAlive = _async$6(function (promise) {
  var timerId = setInterval(function () {}, 10000);
  return _finallyRethrows(function () {
    return _await$5(promise);
  }, function (_wasThrown, _result) {
    clearInterval(timerId);
    return _rethrow(_wasThrown, _result);
  });
});

var nodeRuntime = {
  create: createNodeRuntime
};

function _await$6(value, then, direct) {
  if (direct) {
    return then ? then(value) : value;
  }

  if (!value || !value.then) {
    value = Promise.resolve(value);
  }

  return then ? value.then(then) : value;
}

function _async$7(f) {
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

var execute = _async$7(function (_ref) {
  var projectDirectoryUrl = _ref.projectDirectoryUrl,
      fileRelativeUrl = _ref.fileRelativeUrl,
      compileServerOrigin = _ref.compileServerOrigin,
      outDirectoryRelativeUrl = _ref.outDirectoryRelativeUrl,
      executionId = _ref.executionId,
      _ref$errorExposureInC = _ref.errorExposureInConsole,
      errorExposureInConsole = _ref$errorExposureInC === void 0 ? false : _ref$errorExposureInC;
  return _await$6(nodeRuntime.create({
    projectDirectoryUrl: projectDirectoryUrl,
    compileServerOrigin: compileServerOrigin,
    outDirectoryRelativeUrl: outDirectoryRelativeUrl
  }), function (_ref2) {
    var compileDirectoryRelativeUrl = _ref2.compileDirectoryRelativeUrl,
        executeFile = _ref2.executeFile;

    var _installNodeErrorStac = installNodeErrorStackRemapping({
      projectDirectoryUrl: projectDirectoryUrl
    }),
        getErrorOriginalStackString = _installNodeErrorStac.getErrorOriginalStackString;

    var compiledFileRemoteUrl = util.resolveUrl(fileRelativeUrl, "".concat(compileServerOrigin, "/").concat(compileDirectoryRelativeUrl));
    return executeFile(compiledFileRemoteUrl, {
      executionId: executionId,
      errorTransform: _async$7(function (error) {
        return !error || !(error instanceof Error) ? error : _await$6(getErrorOriginalStackString(error), function (originalStack) {
          error.stack = originalStack;
          return error;
        });
      }),
      errorExposureInConsole: errorExposureInConsole
    });
  });
});

exports.execute = execute;

//# sourceMappingURL=jsenv-node-system.cjs.map