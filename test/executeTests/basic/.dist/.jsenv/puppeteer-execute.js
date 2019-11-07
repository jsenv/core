(function () {
  'use strict';

  // eslint-disable-next-line consistent-return
  var arrayWithoutHoles = (function (arr) {
    if (Array.isArray(arr)) {
      var i = 0;
      var arr2 = new Array(arr.length);

      for (; i < arr.length; i++) {
        arr2[i] = arr[i];
      }

      return arr2;
    }
  });

  // eslint-disable-next-line consistent-return
  var iterableToArray = (function (iter) {
    if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter);
  });

  var nonIterableSpread = (function () {
    throw new TypeError("Invalid attempt to spread non-iterable instance");
  });

  var _toConsumableArray = (function (arr) {
    return arrayWithoutHoles(arr) || iterableToArray(arr) || nonIterableSpread();
  });

  var stackToString = function stackToString(_ref) {
    var stack = _ref.stack,
        error = _ref.error,
        indent = _ref.indent;
    var name = error.name || "Error";
    var message = error.message || "";
    var stackString = stack.map(function (callSite) {
      return "\n".concat(indent, "at ").concat(callSite);
    }).join("");
    return "".concat(name, ": ").concat(message).concat(stackString);
  };

  var methods = ["getColumnNumber", "getEvalOrigin", "getFileName", "getFunction", "getFunctionName", "getLineNumber", "getMethodName", "getPosition", "getScriptNameOrSourceURL", "getThis", "getTypeName", "isConstructor", "isEval", "isNative", "isToplevel", "toString"];
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

  var generateAs = function generateAs(_ref) {
    var methodName = _ref.methodName,
        functionName = _ref.functionName;
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

  var remapSourcePosition = _async(function (_ref) {
    var source = _ref.source,
        line = _ref.line,
        column = _ref.column,
        resolveHref = _ref.resolveHref,
        sourceToSourceMapConsumer = _ref.sourceToSourceMapConsumer,
        readErrorStack = _ref.readErrorStack,
        onFailure = _ref.onFailure;
    var position = {
      source: source,
      line: line,
      column: column
    };
    return _await(sourceToSourceMapConsumer(source), function (sourceMapConsumer) {
      if (!sourceMapConsumer) return position;

      try {
        var originalPosition = sourceMapConsumer.originalPositionFor(position); // Only return the original position if a matching line was found. If no
        // matching line is found then we return position instead, which will cause
        // the stack trace to print the path and line for the compiled file. It is
        // better to give a precise location in the compiled file than a vague
        // location in the original file.

        var originalSource = originalPosition.source;
        if (originalSource === null) return position;
        originalPosition.source = resolveHref({
          type: "file-original",
          specifier: originalSource
        });
        return originalPosition;
      } catch (e) {
        onFailure(createErrorWhileRemappingPositionFailure({
          stack: readErrorStack(e),
          source: source,
          line: line,
          column: column
        }));
        return position;
      }
    });
  });

  var createErrorWhileRemappingPositionFailure = function createErrorWhileRemappingPositionFailure(_ref2) {
    var stack = _ref2.stack,
        source = _ref2.source,
        line = _ref2.line,
        column = _ref2.column;
    return {
      code: "ERROR_WHILE_REMAPPING_POSITION",
      message: "error while remapping position.\n--- error stack ---\n".concat(stack, "\n--- source ---\n").concat(source, "\n--- line ---\n").concat(line, "\n--- column ---\n").concat(column)
    };
  };

  // https://code.google.com/p/v8/source/browse/trunk/src/messages.js

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

  var remapEvalOrigin = _async$1(function (origin, _ref) {
    var _exit = false;
    var resolveHref = _ref.resolveHref,
        sourceToSourceMapConsumer = _ref.sourceToSourceMapConsumer,
        onFailure = _ref.onFailure;
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
          resolveHref: resolveHref,
          sourceToSourceMapConsumer: sourceToSourceMapConsumer,
          onFailure: onFailure
        }), function (originalPosition) {
          _exit = true;
          return "eval at ".concat(topLevelEvalMatch[1], " (").concat(originalPosition.source, ":").concat(originalPosition.line, ":").concat(originalPosition.column + 1, ")");
        });
      }
    }, function (_result) {
      var _exit2 = false;
      if (_exit) return _result;
      // Parse nested eval() calls using recursion
      var nestedEvalMatch = /^eval at ([^(]+) \((.+)\)$/.exec(origin);
      return _invoke(function () {
        if (nestedEvalMatch) {
          return _await$1(remapEvalOrigin(nestedEvalMatch[2], {
            resolveHref: resolveHref,
            sourceToSourceMapConsumer: sourceToSourceMapConsumer,
            onFailure: onFailure
          }), function (originalEvalOrigin) {
            _exit2 = true;
            return "eval at ".concat(nestedEvalMatch[1], " (").concat(originalEvalOrigin, ")");
          });
        }
      }, function (_result2) {
        return _exit2 ? _result2 : origin;
      }); // Make sure we still return useful information if we didn't find anything
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

  function _invoke$1(body, then) {
    var result = body();

    if (result && result.then) {
      return result.then(then);
    }

    return then(result);
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

  var remapCallSite = _async$2(function (callSite, _ref) {
    var _exit = false;
    var sourceToSourceMapConsumer = _ref.sourceToSourceMapConsumer,
        resolveHref = _ref.resolveHref,
        readErrorStack = _ref.readErrorStack,
        onFailure = _ref.onFailure;

    if (callSite.isNative()) {
      return callSite;
    } // Most call sites will return the source file from getFileName(), but code
    // passed to eval() ending in "//# sourceURL=..." will return the source file
    // from getScriptNameOrSourceURL() instead


    var source = callSite.getFileName() || callSite.getScriptNameOrSourceURL();
    return _invoke$1(function () {
      if (source) {
        var line = callSite.getLineNumber();
        var column = callSite.getColumnNumber() - 1;
        return _await$2(remapSourcePosition({
          source: source,
          line: line,
          column: column,
          resolveHref: resolveHref,
          sourceToSourceMapConsumer: sourceToSourceMapConsumer,
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
      return _invoke$1(function () {
        if (callSite.isEval()) {
          var origin = callSite.getEvalOrigin();
          return _invoke$1(function () {
            if (origin) {
              var callSiteClone = cloneCallSite(callSite);
              return _await$2(remapEvalOrigin(origin, {
                resolveHref: resolveHref,
                sourceToSourceMapConsumer: sourceToSourceMapConsumer,
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

  var updateSourceMappingURL = function updateSourceMappingURL(source, callback) {
    var sourceMappingUrlRegExp = /\/\/# ?sourceMappingURL=([^\s'"]+)/g;
    var lastSourceMappingUrl;
    var matchSourceMappingUrl;

    while (matchSourceMappingUrl = sourceMappingUrlRegExp.exec(source)) {
      lastSourceMappingUrl = matchSourceMappingUrl;
    }

    if (lastSourceMappingUrl) {
      var index = lastSourceMappingUrl.index;
      var before = source.slice(0, index);
      var after = source.slice(index);
      var mappedAfter = after.replace(sourceMappingUrlRegExp, function (match, firstGroup) {
        return "//#".concat(" sourceMappingURL=", callback(firstGroup));
      });
      return "".concat(before).concat(mappedAfter);
    }

    return source;
  };
  var readSourceMappingURL = function readSourceMappingURL(source) {
    var sourceMappingURL;
    updateSourceMappingURL(source, function (value) {
      sourceMappingURL = value;
    });
    return sourceMappingURL;
  };
  var parseSourceMappingURL = function parseSourceMappingURL(source) {
    var sourceMappingURL = readSourceMappingURL(source);
    if (!sourceMappingURL) return null;
    var base64Prefix = "data:application/json;charset=utf-8;base64,";

    if (sourceMappingURL.startsWith(base64Prefix)) {
      var mapBase64Source = sourceMappingURL.slice(base64Prefix.length);
      return {
        type: "base64",
        value: mapBase64Source
      };
    }

    return {
      type: "url",
      value: sourceMappingURL
    };
  };

  var memoizeByHref = function memoizeByHref(fn) {
    var hrefCache = {};
    return function (href) {
      if (href in hrefCache) return hrefCache[href];
      var value = fn(href);
      hrefCache[href] = value;
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

  function _invoke$2(body, then) {
    var result = body();

    if (result && result.then) {
      return result.then(then);
    }

    return then(result);
  }

  function _continue(value, then) {
    return value && value.then ? value.then(then) : then(value);
  }

  var generateOriginalStackString = _async$3(function (_ref) {
    var stack = _ref.stack,
        error = _ref.error,
        resolveHref = _ref.resolveHref,
        fetchHref = _ref.fetchHref,
        SourceMapConsumer = _ref.SourceMapConsumer,
        base64ToString = _ref.base64ToString,
        indent = _ref.indent,
        readErrorStack = _ref.readErrorStack,
        onFailure = _ref.onFailure;
    var sourceToSourceMapConsumer = memoizeByHref(_async$3(function (path) {
      var _exit = false;
      return _catch(function () {
        var href = resolveHref({
          type: "file-compiled",
          specifier: path
        });
        var text;
        return _continue(_catch(function () {
          return _await$3(fetchHref(href), function (fileResponse) {
            var _exit2 = false;
            var status = fileResponse.status;
            return _invoke$2(function () {
              if (status !== 200) {
                return _invoke$2(function () {
                  if (status === 404) {
                    onFailure(createCompiledFileNotFoundFailure({
                      href: href
                    }));
                  } else {
                    return _await$3(fileResponse.text(), function (_fileResponse$text) {
                      onFailure(createUnexpectedCompiledFileResponseFailure({
                        status: status,
                        responseText: _fileResponse$text,
                        href: href
                      }));
                    });
                  }
                }, function () {
                  _exit = true;
                  return null;
                });
              }
            }, function (_result2) {
              return _exit2 ? _result2 : _await$3(fileResponse.text(), function (_fileResponse$text2) {
                text = _fileResponse$text2;
              });
            });
          });
        }, function (e) {
          onFailure(createErrorWhileFetchingCompiledFileFailure({
            fetchErrorStack: readErrorStack(e),
            href: href
          }));
          _exit = true;
          return null;
        }), function (_result) {
          var _exit3 = false;
          if (_exit) return _result;
          var sourceMappingURL = parseSourceMappingURL(text);
          if (!sourceMappingURL) return null;
          var sourceMapHref;
          var sourceMapString;
          return _invoke$2(function () {
            if (sourceMappingURL.type === "base64") {
              sourceMapHref = href;
              sourceMapString = base64ToString(sourceMappingURL.value);
            } else {
              sourceMapHref = resolveHref({
                type: "source-map",
                specifier: sourceMappingURL.value,
                importer: href
              });
              return _catch(function () {
                return _await$3(fetchHref(sourceMapHref), function (sourceMapResponse) {
                  var _exit4 = false;
                  var status = sourceMapResponse.status;
                  return _invoke$2(function () {
                    if (status !== 200) {
                      return _invoke$2(function () {
                        if (status === 404) {
                          onFailure(createSourceMapNotFoundFailure({
                            href: sourceMapHref
                          }));
                        } else {
                          return _await$3(sourceMapResponse.text(), function (_sourceMapResponse$te) {
                            onFailure(createUnexpectedSourceMapResponseFailure({
                              status: status,
                              responseText: _sourceMapResponse$te,
                              href: sourceMapHref
                            }));
                          });
                        }
                      }, function () {
                        _exit3 = true;
                        return null;
                      });
                    }
                  }, function (_result4) {
                    return _exit4 ? _result4 : _await$3(sourceMapResponse.text(), function (_sourceMapResponse$te2) {
                      sourceMapString = _sourceMapResponse$te2;
                    });
                  });
                });
              }, function (e) {
                onFailure(createErrorWhileFetchingSourceMapFailure({
                  fetchErrorStack: readErrorStack(e),
                  href: sourceMapHref
                }));
                _exit3 = true;
                return null;
              });
            }
          }, function (_result5) {
            if (_exit3) return _result5;
            var sourceMap;

            try {
              sourceMap = JSON.parse(sourceMapString);
            } catch (e) {
              onFailure(createErrorWhileParsingSourceMapFailure({
                parseErrorStack: readErrorStack(e),
                href: sourceMapHref
              }));
              return null;
            }

            var _sourceMap = sourceMap,
                sourcesContent = _sourceMap.sourcesContent;

            if (!sourcesContent) {
              sourcesContent = [];
              sourceMap.sourcesContent = sourcesContent;
            }

            var firstSourceMapSourceFailure = null;
            return _await$3(Promise.all(sourceMap.sources.map(_async$3(function (source, index) {
              if (index in sourcesContent) return;
              var sourceMapSourceHref = resolveHref({
                type: "source",
                specifier: source,
                importer: sourceMapHref
              });
              return _catch(function () {
                return _await$3(fetchHref(sourceMapSourceHref), function (sourceResponse) {
                  var _exit5 = false;
                  var status = sourceResponse.status;
                  return _invoke$2(function () {
                    if (status !== 200) {
                      if (firstSourceMapSourceFailure) {
                        _exit5 = true;
                        return;
                      }

                      if (status === 404) {
                        firstSourceMapSourceFailure = createSourceMapSourceNotFoundFailure({
                          sourceMapHref: sourceMapHref,
                          sourceMapSourceHref: sourceMapSourceHref
                        });
                        _exit5 = true;
                        return;
                      }

                      return _await$3(sourceResponse.text(), function (_sourceResponse$text) {
                        firstSourceMapSourceFailure = createUnexpectedSourceMapSourceResponseFailure({
                          status: status,
                          responseText: _sourceResponse$text,
                          sourceMapHref: sourceMapHref,
                          sourceMapSourceHref: sourceMapSourceHref
                        });
                        _exit5 = true;
                      });
                    }
                  }, function (_result7) {
                    return _exit5 ? _result7 : _await$3(sourceResponse.text(), function (sourceString) {
                      sourcesContent[index] = sourceString;
                    });
                  });
                });
              }, function (e) {
                if (firstSourceMapSourceFailure) return;
                firstSourceMapSourceFailure = createErrorWhileFetchingSourceMapSourceFailure({
                  fetchErrorStack: readErrorStack(e),
                  sourceMapHref: sourceMapHref,
                  sourceMapSourceHref: sourceMapSourceHref
                });
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
        onFailure(createErrorWhilePreparingSourceMapConsumerFailure({
          errorStack: readErrorStack(e),
          path: path
        }));
        return null;
      });
    }));
    return _catch(function () {
      return _await$3(Promise.all(stack.map(function (callSite) {
        return remapCallSite(callSite, {
          resolveHref: resolveHref,
          sourceToSourceMapConsumer: sourceToSourceMapConsumer,
          readErrorStack: readErrorStack,
          onFailure: onFailure
        });
      })), function (originalStack) {
        return stackToString({
          stack: originalStack,
          error: error,
          indent: indent
        });
      });
    }, function (e) {
      var unmappedStack = stackToString({
        stack: stack,
        error: error,
        indent: indent
      });
      onFailure(createErrorWhileComputingOriginalStackFailure({
        errorWhileComputingStack: readErrorStack(e),
        errorStack: unmappedStack
      })); // in case of error return the non remapped stack

      return unmappedStack;
    });
  });

  var createCompiledFileNotFoundFailure = function createCompiledFileNotFoundFailure(_ref2) {
    var href = _ref2.href;
    return {
      code: "COMPILED_FILE_NOT_FOUND",
      message: "compiled file not found.\n--- compiled file href ---\n".concat(href)
    };
  };

  var createUnexpectedCompiledFileResponseFailure = function createUnexpectedCompiledFileResponseFailure(_ref3) {
    var status = _ref3.status,
        responseText = _ref3.responseText,
        href = _ref3.href;
    return {
      code: "UNEXPECTED_COMPILED_FILE_RESPONSE",
      message: "compiled file unexpected response.\n--- response status ---\n".concat(status, "\n--- response text ---\n").concat(responseText, "\n--- compiled file href ---\n").concat(href)
    };
  };

  var createErrorWhileFetchingCompiledFileFailure = function createErrorWhileFetchingCompiledFileFailure(_ref4) {
    var fetchErrorStack = _ref4.fetchErrorStack,
        href = _ref4.href;
    return {
      code: "ERROR_WHILE_FETCHING_COMPILED_FILE",
      message: "error while fetching compiled file.\n--- fetch error stack ---\n".concat(fetchErrorStack, "\n--- compiled file href ---\n").concat(href)
    };
  };

  var createSourceMapNotFoundFailure = function createSourceMapNotFoundFailure(_ref5) {
    var href = _ref5.href;
    return {
      code: "SOURCE_MAP_NOT_FOUND_FAILURE",
      message: "sourcemap file not found.\n--- sourceMap href ---\n".concat(href)
    };
  };

  var createUnexpectedSourceMapResponseFailure = function createUnexpectedSourceMapResponseFailure(_ref6) {
    var status = _ref6.status,
        responseText = _ref6.responseText,
        href = _ref6.href;
    return {
      code: "UNEXPECTED_SOURCE_MAP_RESPONSE",
      message: "unexpected response for sourcemap file.\n--- response status ---\n".concat(status, "\n--- response text ---\n").concat(responseText, "\n--- sourceMap href ---\n").concat(href)
    };
  };

  var createErrorWhileFetchingSourceMapFailure = function createErrorWhileFetchingSourceMapFailure(_ref7) {
    var fetchErrorStack = _ref7.fetchErrorStack,
        href = _ref7.href;
    return {
      code: "ERROR_WHILE_FETCHING_SOURCE_MAP",
      message: "error while fetching sourcemap.\n--- fetch error stack ---\n".concat(fetchErrorStack, "\n--- sourceMap href ---\n").concat(href)
    };
  };

  var createErrorWhileParsingSourceMapFailure = function createErrorWhileParsingSourceMapFailure(_ref8) {
    var parseErrorStack = _ref8.parseErrorStack,
        href = _ref8.href;
    return {
      code: "ERROR_WHILE_PARSING_SOURCE_MAP",
      message: "error while parsing sourcemap.\n--- parse error stack ---\n".concat(parseErrorStack, "\n--- sourceMap href ---\n").concat(href)
    };
  };

  var createSourceMapSourceNotFoundFailure = function createSourceMapSourceNotFoundFailure(_ref9) {
    var sourceMapSourceHref = _ref9.sourceMapSourceHref,
        sourceMapHref = _ref9.sourceMapHref;
    return {
      code: "SOURCE_MAP_SOURCE_NOT_FOUND",
      message: "sourcemap source not found.\n--- sourcemap source href ---\n".concat(sourceMapSourceHref, "\n--- sourcemap href ---\n").concat(sourceMapHref)
    };
  };

  var createUnexpectedSourceMapSourceResponseFailure = function createUnexpectedSourceMapSourceResponseFailure(_ref10) {
    var status = _ref10.status,
        responseText = _ref10.responseText,
        sourceMapSourceHref = _ref10.sourceMapSourceHref,
        sourceMapHref = _ref10.sourceMapHref;
    return {
      code: "UNEXPECTED_SOURCE_MAP_SOURCE_RESPONSE",
      message: "unexpected response for sourcemap source.\n--- response status ---\n".concat(status, "\n--- response text ---\n").concat(responseText, "\n--- sourceMap source href ---\n").concat(sourceMapSourceHref, "\n--- sourceMap href ---\n").concat(sourceMapHref)
    };
  };

  var createErrorWhileFetchingSourceMapSourceFailure = function createErrorWhileFetchingSourceMapSourceFailure(_ref11) {
    var fetchErrorStack = _ref11.fetchErrorStack,
        sourceMapSourceHref = _ref11.sourceMapSourceHref,
        sourceMapHref = _ref11.sourceMapHref;
    return {
      code: "ERROR_WHILE_FETCHING_SOURCE_MAP_SOURCE",
      message: "error while fetching sourcemap source.\n--- fetch error stack ---\n".concat(fetchErrorStack, "\n--- sourceMap source href ---\n").concat(sourceMapSourceHref, "\n--- sourceMap href ---\n").concat(sourceMapHref)
    };
  };

  var createErrorWhilePreparingSourceMapConsumerFailure = function createErrorWhilePreparingSourceMapConsumerFailure(_ref12) {
    var errorStack = _ref12.errorStack,
        path = _ref12.path;
    return {
      code: "ERROR_WHILE_PREPARING_SOURCEMAP_CONSUMER",
      message: "error while preparing sourceMap consumer.\n--- error stack ---\n".concat(errorStack, "\n--- source path ---\n").concat(path)
    };
  };

  var createErrorWhileComputingOriginalStackFailure = function createErrorWhileComputingOriginalStackFailure(_ref13) {
    var errorWhileComputingStack = _ref13.errorWhileComputingStack,
        errorStack = _ref13.errorStack;
    return {
      code: "ERROR_WHILE_COMPUTING_ORIGINAL_STACK",
      message: "error while computing original stack.\n--- stack from error while computing ---\n".concat(errorWhileComputingStack, "\n--- stack from error to remap ---\n").concat(errorStack)
    };
  };

  function _await$4(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  function _invoke$3(body, then) {
    var result = body();

    if (result && result.then) {
      return result.then(then);
    }

    return then(result);
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

  var installErrorStackRemapping = function installErrorStackRemapping(_ref) {
    var resolveHref = _ref.resolveHref,
        fetchHref = _ref.fetchHref,
        SourceMapConsumer = _ref.SourceMapConsumer,
        base64ToString = _ref.base64ToString,
        _ref$indent = _ref.indent,
        indent = _ref$indent === void 0 ? "  " : _ref$indent;

    if (typeof resolveHref !== "function") {
      throw new TypeError("resolveHref must be a function, got ".concat(resolveHref));
    }

    if (typeof fetchHref !== "function") {
      throw new TypeError("fetchHref must be a function, got ".concat(fetchHref));
    }

    if (typeof base64ToString !== "function") {
      throw new TypeError("base64ToString must be a function, got ".concat(base64ToString));
    }

    if (typeof SourceMapConsumer !== "function") {
      throw new TypeError("sourceMapConsumer must be a function, got ".concat(SourceMapConsumer));
    }

    if (typeof indent !== "string") {
      throw new TypeError("indent must be a string, got ".concat(indent));
    }

    var errorOriginalStackStringCache = new WeakMap();
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

      var originalStackStringPromise = generateOriginalStackString({
        stack: stack,
        error: error,
        resolveHref: resolveHref,
        fetchHref: memoizeFetch(fetchHref),
        SourceMapConsumer: SourceMapConsumer,
        base64ToString: base64ToString,
        readErrorStack: readErrorStack,
        indent: indent,
        onFailure: onFailure
      });
      errorOriginalStackStringCache.set(error, originalStackStringPromise);
      return stackToString({
        stack: stack,
        error: error,
        indent: indent
      });
    };

    var getErrorOriginalStackString = _async$4(function (error) {
      var _exit = false;

      var _ref2 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
          _ref2$onFailure = _ref2.onFailure,
          onFailure = _ref2$onFailure === void 0 ? function (_ref3) {
        var message = _ref3.message;
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
      var promise = errorOriginalStackStringCache.get(error);
      return _invoke$3(function () {
        if (promise) {
          return _await$4(promise, function (originalStack) {
            errorRemapFailureCallbackMap.get(error);
            _exit = true;
            return originalStack;
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

  var memoizeFetch = function memoizeFetch(fetchHref) {
    var hrefCache = {};
    return _async$4(function (href) {
      if (href in hrefCache) {
        return hrefCache[href];
      }

      var responsePromise = fetchHref(href);
      hrefCache[href] = responsePromise;
      return responsePromise;
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

  var installBrowserErrorStackRemapping = function installBrowserErrorStackRemapping() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        resolveHref = _ref.resolveHref,
        SourceMapConsumer = _ref.SourceMapConsumer,
        indent = _ref.indent;

    return installErrorStackRemapping({
      resolveHref: resolveHref,
      fetchHref: fetchHref,
      SourceMapConsumer: SourceMapConsumer,
      base64ToString: base64ToString,
      indent: indent
    });
  };

  var fetchHref = _async$5(function (href) {
    return _await$5(fetch(href), function (response) {
      return _await$5(response.text(), function (_text) {
        return {
          status: response.status,
          // because once memoized fetch
          // gets annoying preventing you to read
          // body multiple times, even using response.clone()
          text: function text() {
            return _text;
          }
        };
      });
    });
  });

  var base64ToString = function base64ToString(base64String) {
    return window.btoa(base64String);
  };

  var nativeTypeOf = function nativeTypeOf(obj) {
    return typeof obj;
  };

  var customTypeOf = function customTypeOf(obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  };

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? nativeTypeOf : customTypeOf;

  var assertImportMap = function assertImportMap(value) {
    if (value === null) {
      throw new TypeError("an importMap must be an object, got null");
    }

    var type = _typeof(value);

    if (type !== "object") {
      throw new TypeError("an importMap must be an object, received ".concat(value));
    }

    if (Array.isArray(value)) {
      throw new TypeError("an importMap must be an object, received array ".concat(value));
    }
  };

  var hasScheme = function hasScheme(string) {
    return /^[a-zA-Z]{2,}:/.test(string);
  };

  var hrefToScheme = function hrefToScheme(href) {
    var colonIndex = href.indexOf(":");
    if (colonIndex === -1) return "";
    return href.slice(0, colonIndex);
  };

  var hrefToPathname = function hrefToPathname(href) {
    return ressourceToPathname(hrefToRessource(href));
  };

  var hrefToRessource = function hrefToRessource(href) {
    var scheme = hrefToScheme(href);

    if (scheme === "file") {
      return href.slice("file://".length);
    }

    if (scheme === "https" || scheme === "http") {
      // remove origin
      var afterProtocol = href.slice(scheme.length + "://".length);
      var pathnameSlashIndex = afterProtocol.indexOf("/", "://".length);
      return afterProtocol.slice(pathnameSlashIndex);
    }

    return href.slice(scheme.length + 1);
  };

  var ressourceToPathname = function ressourceToPathname(ressource) {
    var searchSeparatorIndex = ressource.indexOf("?");
    return searchSeparatorIndex === -1 ? ressource : ressource.slice(0, searchSeparatorIndex);
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

  var pathnameToDirname = function pathnameToDirname(pathname) {
    var slashLastIndex = pathname.lastIndexOf("/");
    if (slashLastIndex === -1) return "";
    return pathname.slice(0, slashLastIndex);
  };

  // could be useful: https://url.spec.whatwg.org/#url-miscellaneous
  var resolveUrl = function resolveUrl(specifier, baseUrl) {
    if (baseUrl) {
      if (typeof baseUrl !== "string") {
        throw new TypeError(writeBaseUrlMustBeAString({
          baseUrl: baseUrl,
          specifier: specifier
        }));
      }

      if (!hasScheme(baseUrl)) {
        throw new Error(writeBaseUrlMustBeAbsolute({
          baseUrl: baseUrl,
          specifier: specifier
        }));
      }
    }

    if (hasScheme(specifier)) {
      return specifier;
    }

    if (!baseUrl) {
      throw new Error(writeBaseUrlRequired({
        baseUrl: baseUrl,
        specifier: specifier
      }));
    } // scheme relative


    if (specifier.slice(0, 2) === "//") {
      return "".concat(hrefToScheme(baseUrl), ":").concat(specifier);
    } // origin relative


    if (specifier[0] === "/") {
      return "".concat(hrefToOrigin(baseUrl)).concat(specifier);
    }

    var baseOrigin = hrefToOrigin(baseUrl);
    var basePathname = hrefToPathname(baseUrl); // pathname relative inside

    if (specifier.slice(0, 2) === "./") {
      var baseDirname = pathnameToDirname(basePathname);
      return "".concat(baseOrigin).concat(baseDirname, "/").concat(specifier.slice(2));
    } // pathname relative outside


    if (specifier.slice(0, 3) === "../") {
      var unresolvedPathname = specifier;
      var importerFolders = basePathname.split("/");
      importerFolders.pop();

      while (unresolvedPathname.slice(0, 3) === "../") {
        // when there is no folder left to resolved
        // we just ignore '../'
        if (importerFolders.length) {
          importerFolders.pop();
        }

        unresolvedPathname = unresolvedPathname.slice(3);
      }

      var resolvedPathname = "".concat(importerFolders.join("/"), "/").concat(unresolvedPathname);
      return "".concat(baseOrigin).concat(resolvedPathname);
    } // bare


    if (basePathname === "") {
      return "".concat(baseOrigin, "/").concat(specifier);
    }

    if (basePathname[basePathname.length] === "/") {
      return "".concat(baseOrigin).concat(basePathname).concat(specifier);
    }

    return "".concat(baseOrigin).concat(pathnameToDirname(basePathname), "/").concat(specifier);
  };

  var writeBaseUrlMustBeAString = function writeBaseUrlMustBeAString(_ref) {
    var baseUrl = _ref.baseUrl,
        specifier = _ref.specifier;
    return "baseUrl must be a string.\n--- base url ---\n".concat(baseUrl, "\n--- specifier ---\n").concat(specifier);
  };

  var writeBaseUrlMustBeAbsolute = function writeBaseUrlMustBeAbsolute(_ref2) {
    var baseUrl = _ref2.baseUrl,
        specifier = _ref2.specifier;
    return "baseUrl must be absolute.\n--- base url ---\n".concat(baseUrl, "\n--- specifier ---\n").concat(specifier);
  };

  var writeBaseUrlRequired = function writeBaseUrlRequired(_ref3) {
    var baseUrl = _ref3.baseUrl,
        specifier = _ref3.specifier;
    return "baseUrl required to resolve relative specifier.\n--- base url ---\n".concat(baseUrl, "\n--- specifier ---\n").concat(specifier);
  };

  var tryUrlResolution = function tryUrlResolution(string, url) {
    var result = resolveUrl(string, url);
    return hasScheme(result) ? result : null;
  };

  var resolveSpecifier = function resolveSpecifier(specifier, importer) {
    if (specifier[0] === "/" || specifier.startsWith("./") || specifier.startsWith("../")) {
      return resolveUrl(specifier, importer);
    }

    if (hasScheme(specifier)) {
      return specifier;
    }

    return null;
  };

  var applyImportMap = function applyImportMap(_ref) {
    var importMap = _ref.importMap,
        specifier = _ref.specifier,
        importer = _ref.importer;
    assertImportMap(importMap);

    if (typeof specifier !== "string") {
      throw new TypeError(writeSpecifierMustBeAString({
        specifier: specifier,
        importer: importer
      }));
    }

    if (importer) {
      if (typeof importer !== "string") {
        throw new TypeError(writeImporterMustBeAString({
          importer: importer,
          specifier: specifier
        }));
      }

      if (!hasScheme(importer)) {
        throw new Error(writeImporterMustBeAbsolute({
          importer: importer,
          specifier: specifier
        }));
      }
    }

    var specifierUrl = resolveSpecifier(specifier, importer);
    var specifierNormalized = specifierUrl || specifier;
    var scopes = importMap.scopes;

    if (scopes && importer) {
      var scopeKeyMatching = Object.keys(scopes).find(function (scopeKey) {
        return scopeKey === importer || specifierIsPrefixOf(scopeKey, importer);
      });

      if (scopeKeyMatching) {
        var scopeValue = scopes[scopeKeyMatching];
        var remappingFromScopeImports = applyImports(specifierNormalized, scopeValue);

        if (remappingFromScopeImports !== null) {
          return remappingFromScopeImports;
        }
      }
    }

    var imports = importMap.imports;

    if (imports) {
      var remappingFromImports = applyImports(specifierNormalized, imports);

      if (remappingFromImports !== null) {
        return remappingFromImports;
      }
    }

    if (specifierUrl) {
      return specifierUrl;
    }

    throw new Error(writeBareSpecifierMustBeRemapped({
      specifier: specifier,
      importer: importer
    }));
  };

  var applyImports = function applyImports(specifier, imports) {
    var importKeyArray = Object.keys(imports);
    var i = 0;

    while (i < importKeyArray.length) {
      var importKey = importKeyArray[i];
      i++;

      if (importKey === specifier) {
        var importValue = imports[importKey];
        return importValue;
      }

      if (specifierIsPrefixOf(importKey, specifier)) {
        var _importValue = imports[importKey];
        var afterImportKey = specifier.slice(importKey.length);
        return tryUrlResolution(afterImportKey, _importValue);
      }
    }

    return null;
  };

  var specifierIsPrefixOf = function specifierIsPrefixOf(specifierHref, href) {
    return specifierHref[specifierHref.length - 1] === "/" && href.startsWith(specifierHref);
  };

  var writeSpecifierMustBeAString = function writeSpecifierMustBeAString(_ref2) {
    var specifier = _ref2.specifier,
        importer = _ref2.importer;
    return "specifier must be a string.\n--- specifier ---\n".concat(specifier, "\n--- importer ---\n").concat(importer);
  };

  var writeImporterMustBeAString = function writeImporterMustBeAString(_ref3) {
    var importer = _ref3.importer,
        specifier = _ref3.specifier;
    return "importer must be a string.\n--- importer ---\n".concat(importer, "\n--- specifier ---\n").concat(specifier);
  };

  var writeImporterMustBeAbsolute = function writeImporterMustBeAbsolute(_ref4) {
    var importer = _ref4.importer,
        specifier = _ref4.specifier;
    return "importer must be an absolute url.\n--- importer ---\n".concat(importer, "\n--- specifier ---\n").concat(specifier);
  };

  var writeBareSpecifierMustBeRemapped = function writeBareSpecifierMustBeRemapped(_ref5) {
    var specifier = _ref5.specifier,
        importer = _ref5.importer;
    return "Unmapped bare specifier.\n--- specifier ---\n".concat(specifier, "\n--- importer ---\n").concat(importer);
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

  function _objectSpread (target) {
    for (var i = 1; i < arguments.length; i++) {
      // eslint-disable-next-line prefer-rest-params
      var source = arguments[i] === null ? {} : arguments[i];

      if (i % 2) {
        // eslint-disable-next-line no-loop-func
        ownKeys(source, true).forEach(function (key) {
          _defineProperty(target, key, source[key]);
        });
      } else if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
      } else {
        // eslint-disable-next-line no-loop-func
        ownKeys(source).forEach(function (key) {
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

  var pathnameToExtension = function pathnameToExtension(pathname) {
    var slashLastIndex = pathname.lastIndexOf("/");

    if (slashLastIndex !== -1) {
      pathname = pathname.slice(slashLastIndex + 1);
    }

    var dotLastIndex = pathname.lastIndexOf(".");
    if (dotLastIndex === -1) return ""; // if (dotLastIndex === pathname.length - 1) return ""

    return pathname.slice(dotLastIndex);
  };

  // directly target the files because this code
  var resolveImport = function resolveImport(_ref) {
    var specifier = _ref.specifier,
        importer = _ref.importer,
        importMap = _ref.importMap,
        _ref$defaultExtension = _ref.defaultExtension,
        defaultExtension = _ref$defaultExtension === void 0 ? true : _ref$defaultExtension;
    return applyDefaultExtension({
      url: importMap ? applyImportMap({
        importMap: importMap,
        specifier: specifier,
        importer: importer
      }) : resolveUrl(specifier, importer),
      importer: importer,
      defaultExtension: defaultExtension
    });
  };

  var applyDefaultExtension = function applyDefaultExtension(_ref2) {
    var url = _ref2.url,
        importer = _ref2.importer,
        defaultExtension = _ref2.defaultExtension;

    if (typeof defaultExtension === "string") {
      var extension = pathnameToExtension(url);

      if (extension === "") {
        return "".concat(url).concat(defaultExtension);
      }

      return url;
    }

    if (defaultExtension === true) {
      var _extension = pathnameToExtension(url);

      if (_extension === "" && importer) {
        var importerPathname = hrefToPathname(importer);
        var importerExtension = pathnameToExtension(importerPathname);
        return "".concat(url).concat(importerExtension);
      }
    }

    return url;
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

  var loadScript = _async$6(function (url) {
    return _await$6(fetchUsingXhr(url), function (_ref) {
      var status = _ref.status,
          body = _ref.body;

      if (status >= 200 && status <= 299) {
        // eslint-disable-next-line no-eval
        window.eval(appendSourceURL(body, url));
      } else {
        throw new Error(createUnexpectedScriptResponseMessage({
          url: url,
          status: status,
          body: body
        }));
      }
    });
  });

  var appendSourceURL = function appendSourceURL(code, sourceURL) {
    return "".concat(code, "\n", "//#", " sourceURL=").concat(sourceURL);
  };

  var createUnexpectedScriptResponseMessage = function createUnexpectedScriptResponseMessage(_ref2) {
    var url = _ref2.url,
        status = _ref2.status,
        body = _ref2.body;
    return "Unexpected response for script.\n--- script url ---\n".concat(url, "\n--- response body ---\n").concat(body, "\n--- response status ---\n").concat(status);
  };

  var fetchUsingXhr = function fetchUsingXhr(url) {
    var _ref3 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref3$credentials = _ref3.credentials,
        credentials = _ref3$credentials === void 0 ? "same-origin" : _ref3$credentials,
        _ref3$headers = _ref3.headers,
        headers = _ref3$headers === void 0 ? {} : _ref3$headers;

    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();

      var cleanup = function cleanup() {
        xhr.ontimeout = null;
        xhr.onerror = null;
        xhr.onload = null;
        xhr.onreadystatechange = null;
      };

      xhr.ontimeout = function () {
        cleanup();
        reject(createRequestTimeoutError({
          url: url
        }));
      };

      xhr.onerror = function (error) {
        cleanup();

        if (typeof window.ProgressEvent === "function" && error instanceof ProgressEvent) {
          // unfortunately with have no clue why it fails
          // might be cors for instance
          reject(createRequestError({
            url: url
          }));
        } else {
          reject(error);
        }
      };

      xhr.onload = function () {
        cleanup();

        if (xhr.status === 0) {
          resolve(_objectSpread({}, normalizeXhr(xhr), {
            status: 200
          }));
        } else {
          resolve(normalizeXhr(xhr));
        }
      };

      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) {
          return;
        } // in Chrome on file:/// URLs, status is 0


        if (xhr.status === 0) {
          if (xhr.responseText) {
            xhr.onload();
          }

          return;
        }

        cleanup();
        resolve(normalizeXhr(xhr));
      };

      xhr.open("GET", url, true);
      Object.keys(headers).forEach(function (key) {
        xhr.setRequestHeader(key, headers[key]);
      });
      xhr.withCredentials = computeWithCredentials({
        credentials: credentials,
        url: url
      });
      xhr.send(null);
    });
  }; // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch


  var computeWithCredentials = function computeWithCredentials(_ref4) {
    var credentials = _ref4.credentials,
        url = _ref4.url;

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

  var createRequestError = function createRequestError(_ref5) {
    var url = _ref5.url;
    var error = new Error("request error.\nurl: ".concat(url));
    error.code = "REQUEST_ERROR";
    return error;
  };

  var createRequestTimeoutError = function createRequestTimeoutError(_ref6) {
    var url = _ref6.url;
    var error = new Error("request timeout.\nurl: ".concat(url));
    error.code = "REQUEST_TIMEOUT";
    return error;
  };

  var normalizeXhr = function normalizeXhr(xhr) {
    return {
      // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/responseURL
      url: xhr.responseURL,
      status: xhr.status,
      statusText: xhr.statusText,
      headers: getHeadersFromXHR(xhr),
      body: xhr.responseText
    };
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

  function _await$7(value, then, direct) {
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

  window.execute = _async$7(function (_ref) {
    var compileServerOrigin = _ref.compileServerOrigin,
        fileRelativePath = _ref.fileRelativePath,
        collectNamespace = _ref.collectNamespace,
        collectCoverage = _ref.collectCoverage,
        executionId = _ref.executionId,
        _ref$errorExposureInC = _ref.errorExposureInConsole,
        errorExposureInConsole = _ref$errorExposureInC === void 0 ? false : _ref$errorExposureInC,
        _ref$errorExposureInN = _ref.errorExposureInNotification,
        errorExposureInNotification = _ref$errorExposureInN === void 0 ? false : _ref$errorExposureInN,
        _ref$errorExposureInD = _ref.errorExposureInDocument,
        errorExposureInDocument = _ref$errorExposureInD === void 0 ? true : _ref$errorExposureInD;
    return _await$7(loadScript("".concat(compileServerOrigin, "/.jsenv/browser-platform.js")), function () {
      var _window = window,
          __browserPlatform__ = _window.__browserPlatform__;

      var _browserPlatform__$c = __browserPlatform__.create({
        compileServerOrigin: compileServerOrigin
      }),
          relativePathToCompiledHref = _browserPlatform__$c.relativePathToCompiledHref,
          executeFile = _browserPlatform__$c.executeFile;

      return _await$7(loadScript("/node_modules/source-map/dist/source-map.js"), function () {
        var SourceMapConsumer = window.sourceMap.SourceMapConsumer;
        SourceMapConsumer.initialize({
          "lib/mappings.wasm": "/node_modules/source-map/lib/mappings.wasm"
        });

        var _installBrowserErrorS = installBrowserErrorStackRemapping({
          resolveHref: function resolveHref(_ref2) {
            var specifier = _ref2.specifier,
                _ref2$importer = _ref2.importer,
                importer = _ref2$importer === void 0 ? "".concat(compileServerOrigin).concat(fileRelativePath) : _ref2$importer;
            return resolveImport({
              specifier: specifier,
              importer: importer
            });
          },
          SourceMapConsumer: SourceMapConsumer
        }),
            getErrorOriginalStackString = _installBrowserErrorS.getErrorOriginalStackString;

        return executeFile(relativePathToCompiledHref(fileRelativePath), {
          collectNamespace: collectNamespace,
          collectCoverage: collectCoverage,
          executionId: executionId,
          errorExposureInConsole: errorExposureInConsole,
          errorExposureInNotification: errorExposureInNotification,
          errorExposureInDocument: errorExposureInDocument,
          errorTransform: _async$7(function (error) {
            return !error || !(error instanceof Error) ? error : _await$7(getErrorOriginalStackString(error), function (originalStack) {
              error.stack = originalStack;
              return error;
            });
          })
        });
      });
    });
  });

}());

//# sourceMappingURL=./puppeteer-execute.js__asset__/puppeteer-execute.js.map