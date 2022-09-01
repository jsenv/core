function _typeof2(obj) { "@babel/helpers - typeof"; return _typeof2 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof2(obj); }

(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof exports !== "undefined") {
    factory();
  } else {
    var mod = {
      exports: {}
    };
    factory();
    global.s = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function () {
  "use strict"; // eslint-disable-next-line consistent-return

  var arrayWithHoles = function arrayWithHoles(arr) {
    if (Array.isArray(arr)) return arr;
  };

  function _iterableToArrayLimit(arr, i) {
    // this is an expanded form of \`for...of\` that properly supports abrupt completions of
    // iterators etc. variable names have been minimised to reduce the size of this massive
    // helper. sometimes spec compliance is annoying :(
    //
    // _n = _iteratorNormalCompletion
    // _d = _didIteratorError
    // _e = _iteratorError
    // _i = _iterator
    // _s = _step
    var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"];

    if (_i == null) return;
    var _arr = [];
    var _n = true;
    var _d = false;

    var _s, _e;

    try {
      for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"] != null) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }
  /* eslint-disable no-eq-null, eqeqeq */


  function arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    var arr2 = new Array(len);

    for (var i = 0; i < len; i++) {
      arr2[i] = arr[i];
    }

    return arr2;
  }
  /* eslint-disable consistent-return */


  function unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return arrayLikeToArray(o, minLen);
  }

  var nonIterableRest = function nonIterableRest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  };

  var _slicedToArray = function _slicedToArray(arr, i) {
    return arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || unsupportedIterableToArray(arr, i) || nonIterableRest();
  };

  var nativeTypeOf = function nativeTypeOf(obj) {
    return _typeof2(obj);
  };

  var customTypeOf = function customTypeOf(obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : _typeof2(obj);
  };

  var _typeof = typeof Symbol === "function" && _typeof2(Symbol.iterator) === "symbol" ? nativeTypeOf : customTypeOf;
  /*
   * This file is a modified version of https://github.com/systemjs/systemjs/blob/main/dist/s.js
   * with the following changes:
   *
   * - Code can use aync/await, const, etc because this file is compiled (see dist/s.js)
   * - Can use document.currentScript because we don't support IE
   * - auto import inline System.register
   * - auto import first System.register in web workers
   * - queing events in web workers
   * - no support for importmap because jsenv don't need it
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

  function _empty() {}

  function _awaitIgnored(value, direct) {
    if (!direct) {
      return value && value.then ? value.then(_empty) : Promise.resolve();
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

  (function () {
    /* eslint-env browser */

    /* globals self */
    var loadRegistry = Object.create(null);
    var registerRegistry = Object.create(null);
    var inlineScriptCount = 0;
    var System = {};
    var hasDocument = (typeof document === "undefined" ? "undefined" : _typeof(document)) === "object";
    var envGlobal = self;
    var isWorker = !hasDocument && typeof envGlobal.WorkerGlobalScope === "function" && envGlobal instanceof envGlobal.WorkerGlobalScope;
    var isServiceWorker = isWorker && typeof self.skipWaiting === "function";
    envGlobal.System = System;
    var baseUrl = envGlobal.location.href.split("#")[0].split("?")[0];
    var lastSlashIndex = baseUrl.lastIndexOf("/");

    if (lastSlashIndex !== -1) {
      baseUrl = baseUrl.slice(0, lastSlashIndex + 1);
    }

    var resolveUrl = function resolveUrl(specifier, baseUrl) {
      return new URL(specifier, baseUrl).href;
    };

    if (hasDocument) {
      var baseElement = document.querySelector("base[href]");

      if (baseElement) {
        baseUrl = baseElement.href;
      }

      System.register = function (deps, declare) {
        if (!document.currentScript) {
          throw new Error("unexpected call to System.register (document.currentScript is undefined)");
        }

        if (document.currentScript.__s__) {
          registerRegistry[document.currentScript.src] = [deps, declare];
          return null;
        }

        var url = document.currentScript.src || "".concat(window.location.href, "__inline_script__").concat(++inlineScriptCount);
        registerRegistry[url] = [deps, declare];
        return _import2(url);
      };

      System.instantiate = function (url) {
        var script = createScript(url);
        return new Promise(function (resolve, reject) {
          var lastWindowErrorUrl;
          var lastWindowError;

          var windowErrorCallback = function windowErrorCallback(event) {
            lastWindowErrorUrl = event.filename;
            lastWindowError = event.error;
          };

          window.addEventListener("error", windowErrorCallback);
          script.addEventListener("error", function () {
            window.removeEventListener("error", windowErrorCallback);
            reject("An error occured while loading url with <script> for ".concat(url));
          });
          script.addEventListener("load", function () {
            window.removeEventListener("error", windowErrorCallback);
            document.head.removeChild(script); // Note that if an error occurs that isn't caught by this if statement,
            // that getRegister will return null and a "did not instantiate" error will be thrown.

            if (lastWindowErrorUrl === url) {
              reject(lastWindowError);
            } else {
              resolve();
            }
          });
          document.head.appendChild(script);
        });
      };

      var createScript = function createScript(url) {
        var script = document.createElement("script");
        script.async = true; // Only add cross origin for actual cross origin
        // this is because Safari triggers for all
        // - https://bugs.webkit.org/show_bug.cgi?id=171566

        if (url.indexOf("".concat(self.location.origin, "/"))) {
          script.crossOrigin = "anonymous";
        }

        script.__s__ = true;
        script.src = url;
        return script;
      };
    }

    if (isWorker) {
      /*
       * SystemJs loads X files before executing the worker/service worker main file
       * It mean events dispatched during this phase could be missed
       * A warning like the one below is displayed in chrome devtools:
       * "Event handler of 'install' event must be added on the initial evaluation of worker script"
       * To fix that code below listen for these events early and redispatch them later
       * once the worker file is executed (the listeners are installed)
       */
      var firstImportCallbacks = [];

      if (isServiceWorker) {
        // for service worker there is more events to listen
        // and, to get rid of the warning, we override self.addEventListener
        var eventsToCatch = ["message", "install", "activate", "fetch"];
        var eventCallbackProxies = {};
        var firstImportPromise = new Promise(function (resolve) {
          firstImportCallbacks.push(resolve);
        });
        eventsToCatch.forEach(function (eventName) {
          var eventsToDispatch = [];

          var eventCallback = function eventCallback(event) {
            var eventCallbackProxy = eventCallbackProxies[event.type];

            if (eventCallbackProxy) {
              eventCallbackProxy(event);
            } else {
              eventsToDispatch.push(event);
              event.waitUntil(firstImportPromise);
            }
          };

          self.addEventListener(eventName, eventCallback);
          firstImportCallbacks.push(function () {
            if (eventsToDispatch.length) {
              var eventCallbackProxy = eventCallbackProxies[eventsToDispatch[0].type];

              if (eventCallbackProxy) {
                eventsToDispatch.forEach(function (event) {
                  eventCallbackProxy(event);
                });
              }

              eventsToDispatch.length = 0;
            }
          });
        });
        var addEventListener = self.addEventListener;

        self.addEventListener = function (eventName, callback, options) {
          if (eventsToCatch.indexOf(eventName) > -1) {
            eventCallbackProxies[eventName] = callback;
            return null;
          }

          return addEventListener.call(self, eventName, callback, options);
        };
      } else {
        var _eventsToCatch = ["message"];

        _eventsToCatch.forEach(function (eventName) {
          var eventQueue = [];

          var eventCallback = function eventCallback(event) {
            eventQueue.push(event);
          };

          self.addEventListener(eventName, eventCallback);
          firstImportCallbacks.push(function () {
            self.removeEventListener(eventName, eventCallback);
            eventQueue.forEach(function (event) {
              self.dispatchEvent(event);
            });
            eventQueue.length = 0;
          });
        });
      }

      System.register = _async(function (deps, declare) {
        System.register = function () {
          throw new Error("unexpected call to System.register (called outside url instantiation)");
        };

        var url = self.location.href;
        registerRegistry[url] = [deps, declare];
        return _await(_import2(url), function (namespace) {
          firstImportCallbacks.forEach(function (firstImportCallback) {
            firstImportCallback();
          });
          firstImportCallbacks.length = 0;
          return namespace;
        });
      });
      System.instantiate = _async(function (url) {
        return _await(self.fetch(url, {
          credentials: "same-origin"
        }), function (response) {
          if (!response.ok) {
            throw Error("Failed to fetch module at ".concat(url));
          }

          return _await(response.text(), function (source) {
            if (source.indexOf("//# sourceURL=") < 0) {
              source += "\n//# sourceURL=".concat(url);
            }

            var register = System.register;

            System.register = function (deps, declare) {
              registerRegistry[url] = [deps, declare];
            };

            (0, self.eval)(source);
            System.register = register;
          });
        });
      });
    }

    var _import2 = function _import(specifier, parentUrl) {
      var url = resolveUrl(specifier, parentUrl);
      var load = getOrCreateLoad(url, parentUrl);
      return load.completionPromise || startExecution(load, parentUrl);
    };

    var getOrCreateLoad = function getOrCreateLoad(url, firstParentUrl) {
      var existingLoad = loadRegistry[url];

      if (existingLoad) {
        return existingLoad;
      }

      var namespace = createNamespace();
      var load = {
        url: url,
        deps: [],
        dependencyLoads: [],
        instantiatePromise: null,
        linkPromise: null,
        executePromise: null,
        completionPromise: null,
        importerSetters: [],
        setters: [],
        execute: null,
        error: null,
        hoistedExports: false,
        namespace: namespace
      };
      loadRegistry[url] = load;
      load.instantiatePromise = _async(function () {
        return _catch(function () {
          var registration = registerRegistry[url];
          return _invoke(function () {
            if (!registration) {
              var instantiateReturnValue = System.instantiate(url, firstParentUrl);
              return _invoke(function () {
                if (instantiateReturnValue) {
                  return _awaitIgnored(instantiateReturnValue);
                }
              }, function () {
                registration = registerRegistry[url];
              });
            }
          }, function () {
            if (!registration) {
              throw new Error("System.register() not called after executing ".concat(url));
            }

            var _export = function _export(firstArg, secondArg) {
              load.hoistedExports = true;
              var changed = false;

              if (typeof firstArg === "string") {
                var name = firstArg;
                var value = secondArg;

                if (!(name in namespace) || namespace[name] !== value) {
                  namespace[name] = value;
                  changed = true;
                }
              } else {
                Object.keys(firstArg).forEach(function (name) {
                  var value = firstArg[name];

                  if (!(name in namespace) || namespace[name] !== value) {
                    namespace[name] = value;
                    changed = true;
                  }
                });

                if (firstArg && firstArg.__esModule) {
                  namespace.__esModule = firstArg.__esModule;
                }
              }

              if (changed) {
                load.importerSetters.forEach(function (importerSetter) {
                  if (importerSetter) {
                    importerSetter(namespace);
                  }
                });
              }

              return secondArg;
            };

            var _registration = registration,
                _registration2 = _slicedToArray(_registration, 2),
                deps = _registration2[0],
                declare = _registration2[1];

            var _declare = declare(_export, {
              import: function _import(importId) {
                return _import2(importId, url);
              },
              meta: createMeta(url)
            }),
                setters = _declare.setters,
                _declare$execute = _declare.execute,
                execute = _declare$execute === void 0 ? function () {} : _declare$execute;

            load.deps = deps;
            load.setters = setters;
            load.execute = execute;
          });
        }, function (e) {
          load.error = e;
          load.execute = null;
        });
      })();
      load.linkPromise = _async(function () {
        return _await(load.instantiatePromise, function () {
          return _await(Promise.all(load.deps.map(_async(function (dep, index) {
            var setter = load.setters[index];
            var dependencyUrl = resolveUrl(dep, url);
            var dependencyLoad = getOrCreateLoad(dependencyUrl, url);
            return _invoke(function () {
              if (dependencyLoad.instantiatePromise) {
                return _awaitIgnored(dependencyLoad.instantiatePromise);
              }
            }, function () {
              if (setter) {
                dependencyLoad.importerSetters.push(setter);

                if (dependencyLoad.hoistedExports || !dependencyLoad.instantiatePromise) {
                  setter(dependencyLoad.namespace);
                }
              }

              return dependencyLoad;
            });
          }))), function (dependencyLoads) {
            load.dependencyLoads = dependencyLoads;
          });
        });
      })();
      return load;
    };

    var startExecution = _async(function (load, importerUrl) {
      load.completionPromise = function () {
        return _await(instantiateAll(load, load, {}), function () {
          return _await(postOrderExec(load, importerUrl ? [importerUrl] : []), function () {
            return load.namespace;
          });
        });
      }();

      return load.completionPromise;
    });

    var instantiateAll = _async(function (load, parent, loaded) {
      if (loaded[load.url]) {
        return;
      }

      loaded[load.url] = true;
      return _catch(function () {
        return _invoke(function () {
          if (load.linkPromise) {
            // load.linkPromise is null once instantiated
            return _awaitIgnored(load.linkPromise);
          }
        }, function () {
          return _awaitIgnored(Promise.all(load.dependencyLoads.map(function (dependencyLoad) {
            return instantiateAll(dependencyLoad, parent, loaded);
          })));
        });
      }, function (error) {
        if (load.error) {
          throw error;
        }

        load.execute = null;
        throw error;
      });
    });

    var postOrderExec = function postOrderExec(load, importStack) {
      if (importStack.indexOf(load.url) > -1) {
        return undefined;
      }

      if (!load.execute) {
        if (load.error) {
          throw load.error;
        }

        if (load.executePromise) {
          return load.executePromise;
        }

        return undefined;
      } // deps execute first, unless circular


      var depLoadPromises = [];
      load.dependencyLoads.forEach(function (dependencyLoad) {
        try {
          var depImportStack = importStack.slice();
          depImportStack.push(load.url);
          var depLoadPromise = postOrderExec(dependencyLoad, depImportStack);

          if (depLoadPromise) {
            depLoadPromises.push(depLoadPromise);
          }
        } catch (err) {
          load.execute = null;
          load.error = err;
          throw err;
        }
      });
      return _async(function () {
        return _invoke(function () {
          if (depLoadPromises.length) {
            var allDepPromise = Promise.all(depLoadPromises);
            return _awaitIgnored(allDepPromise);
          }
        }, function () {
          try {
            var executeReturnValue = load.execute.call(nullContext);

            if (executeReturnValue) {
              load.executePromise = executeReturnValue.then(function () {
                load.executePromise = null;
                load.completionPromise = load.namespace;
              }, function (error) {
                load.executePromise = null;
                load.error = error;
                throw error;
              });
              return;
            }

            load.instantiatePromise = null;
            load.linkPromise = null;
            load.completionPromise = load.namespace;
          } catch (error) {
            load.error = error;
            throw error;
          } finally {
            load.execute = null;
          }
        });
      })();
    }; // the closest we can get to call(undefined)


    var nullContext = Object.freeze(Object.create(null));

    var createMeta = function createMeta(url) {
      return {
        url: url,
        resolve: function resolve(id, parentUrl) {
          return resolveUrl(id, parentUrl);
        }
      };
    };

    var createNamespace = typeof Symbol !== "undefined" && Symbol.toStringTag ? function () {
      var namespace = Object.create(null);
      Object.defineProperty(namespace, Symbol.toStringTag, {
        value: "Module"
      });
      return namespace;
    } : function () {
      return Object.create(null);
    };
  })();
});
//# sourceMappingURL=s.js.map
