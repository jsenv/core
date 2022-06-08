/*
* SJS 6.12.1
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
    if (baseEl)
      baseUrl = baseEl.href;
  }

  if (!baseUrl && typeof location !== 'undefined') {
    baseUrl = location.href.split('#')[0].split('?')[0];
    var lastSepIndex = baseUrl.lastIndexOf('/');
    if (lastSepIndex !== -1)
      baseUrl = baseUrl.slice(0, lastSepIndex + 1);
  }

  var backslashRegEx = /\\/g;
  function resolveIfNotPlainOrUrl (relUrl, parentUrl) {
    if (relUrl.indexOf('\\') !== -1)
      relUrl = relUrl.replace(backslashRegEx, '/');
    // protocol-relative
    if (relUrl[0] === '/' && relUrl[1] === '/') {
      return parentUrl.slice(0, parentUrl.indexOf(':') + 1) + relUrl;
    }
    // relative-url
    else if (relUrl[0] === '.' && (relUrl[1] === '/' || relUrl[1] === '.' && (relUrl[2] === '/' || relUrl.length === 2 && (relUrl += '/')) ||
        relUrl.length === 1  && (relUrl += '/')) ||
        relUrl[0] === '/') {
      var parentProtocol = parentUrl.slice(0, parentUrl.indexOf(':') + 1);
      // Disabled, but these cases will give inconsistent results for deep backtracking
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
        }
        else {
          pathname = parentUrl.slice(8);
        }
      }
      else {
        // resolving to :/ so pathname is the /... part
        pathname = parentUrl.slice(parentProtocol.length + (parentUrl[parentProtocol.length] === '/'));
      }

      if (relUrl[0] === '/')
        return parentUrl.slice(0, parentUrl.length - pathname.length - 1) + relUrl;

      // join together and split for removal of .. and . segments
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
        }

        // new segment - check if it is relative
        else if (segmented[i] === '.') {
          // ../ segment
          if (segmented[i + 1] === '.' && (segmented[i + 2] === '/' || i + 2 === segmented.length)) {
            output.pop();
            i += 2;
          }
          // ./ segment
          else if (segmented[i + 1] === '/' || i + 1 === segmented.length) {
            i += 1;
          }
          else {
            // the start of a new segment as below
            segmentIndex = i;
          }
        }
        // it is the start of a new segment
        else {
          segmentIndex = i;
        }
      }
      // finish reading out the last segment
      if (segmentIndex !== -1)
        output.push(segmented.slice(segmentIndex));
      return parentUrl.slice(0, parentUrl.length - pathname.length) + output.join('');
    }
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
  var registerRegistry = Object.create(null)

  function SystemJS () {
    this[REGISTRY] = {};
  }

  var systemJSPrototype = SystemJS.prototype;

  systemJSPrototype.import = function (id, parentUrl) {
    var loader = this;
    id = loader.resolve(String(id), parentUrl)
    var load = getOrCreateLoad(loader, id);
    return load.C || topLevelLoad(loader, load);
  };

  // Hookable createContext function -> allowing eg custom import meta
  systemJSPrototype.createContext = function (parentId) {
    var loader = this;
    return {
      url: parentId,
      resolve: function (id, parentUrl) {
        return Promise.resolve(loader.resolve(id, parentUrl || parentId));
      }
    };
  };

  function getOrCreateLoad (loader, id, firstParentUrl) {
    var load = loader[REGISTRY][id];
    if (load)
      return load;

    var importerSetters = [];
    var ns = Object.create(null);
    if (toStringTag)
      Object.defineProperty(ns, toStringTag, { value: 'Module' });
    
    var instantiatePromise = Promise.resolve()
    .then(function () {
      return loader.instantiate(id, firstParentUrl);
    })
    .then(function (registration) {
      if (!registration)
        throw Error(errMsg(2, id ));
      function _export (name, value) {
        // note if we have hoisted exports (including reexports)
        load.h = true;
        var changed = false;
        if (typeof name === 'string') {
          if (!(name in ns) || ns[name] !== value) {
            ns[name] = value;
            changed = true;
          }
        }
        else {
          for (var p in name) {
            var value = name[p];
            if (!(p in ns) || ns[p] !== value) {
              ns[p] = value;
              changed = true;
            }
          }

          if (name && name.__esModule) {
            ns.__esModule = name.__esModule;
          }
        }
        if (changed)
          for (var i = 0; i < importerSetters.length; i++) {
            var setter = importerSetters[i];
            if (setter) setter(ns);
          }
        return value;
      }
      var declared = registration[1](_export, registration[1].length === 2 ? {
        import: function (importId) {
          return loader.import(importId, id);
        },
        meta: loader.createContext(id)
      } : undefined);
      load.e = declared.execute || function () {};
      return [registration[0], declared.setters || []];
    }, function (err) {
      load.e = null;
      load.er = err;
      throw err;
    });

    var linkPromise = instantiatePromise
    .then(function (instantiation) {
      return Promise.all(instantiation[0].map(function (dep, i) {
        var setter = instantiation[1][i];
        return Promise.resolve(loader.resolve(dep, id))
        .then(function (depId) {
          var depLoad = getOrCreateLoad(loader, depId, id);
          // depLoad.I may be undefined for already-evaluated
          return Promise.resolve(depLoad.I)
          .then(function () {
            if (setter) {
              depLoad.i.push(setter);
              // only run early setters when there are hoisted exports of that module
              // the timing works here as pending hoisted export calls will trigger through importerSetters
              if (depLoad.h || !depLoad.I)
                setter(depLoad.n);
            }
            return depLoad;
          });
        });
      }))
      .then(function (depLoads) {
        load.d = depLoads;
      });
    });

    // Capital letter = a promise function
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
      e: undefined,

      // On execution we have populated:
      // the execution error if any
      er: undefined,
      // in the case of TLA, the execution promise
      E: undefined,

      // On execution, L, I, E cleared

      // Promise for top-level completion
      C: undefined,

      // parent instantiator / executor
      p: undefined
    };
  }

  function instantiateAll (loader, load, parent, loaded) {
    if (!loaded[load.id]) {
      loaded[load.id] = true;
      // load.L may be undefined for already-instantiated
      return Promise.resolve(load.L)
      .then(function () {
        if (!load.p || load.p.e === null)
          load.p = parent;
        return Promise.all(load.d.map(function (dep) {
          return instantiateAll(loader, dep, parent, loaded);
        }));
      })
      .catch(function (err) {
        if (load.er)
          throw err;
        load.e = null;
        throw err;
      });
    }
  }

  function topLevelLoad (loader, load) {
    return load.C = instantiateAll(loader, load, load, {})
    .then(function () {
      return postOrderExec(loader, load, {});
    })
    .then(function () {
      return load.n;
    });
  }

  // the closest we can get to call(undefined)
  var nullContext = Object.freeze(Object.create(null));

  // returns a promise if and only if a top-level await subgraph
  // throws on sync errors
  function postOrderExec (loader, load, seen) {
    if (seen[load.id])
      return;
    seen[load.id] = true;

    if (!load.e) {
      if (load.er)
        throw load.er;
      if (load.E)
        return load.E;
      return;
    }

    // deps execute first, unless circular
    var depLoadPromises;
    load.d.forEach(function (depLoad) {
      try {
        var depLoadPromise = postOrderExec(loader, depLoad, seen);
        if (depLoadPromise) 
          (depLoadPromises = depLoadPromises || []).push(depLoadPromise);
      }
      catch (err) {
        load.e = null;
        load.er = err;
        throw err;
      }
    });
    if (depLoadPromises)
      return Promise.all(depLoadPromises).then(doExec);

    return doExec();

    function doExec () {
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
            if (!true) ;
            throw err;
          });
          return load.E = execPromise;
        }
        // (should be a promise, but a minify optimization to leave out Promise.resolve)
        load.C = load.n;
        load.L = load.I = undefined;
      }
      catch (err) {
        load.er = err;
        throw err;
      }
      finally {
        load.e = null;
      }
    }
  }

  envGlobal.System = new SystemJS();

  /*
   * SystemJS browser attachments for script and import map processing
   */
  systemJSPrototype.baseUrl = baseUrl;

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
    script.async = true;
    // Only add cross origin for actual cross origin
    // this is because Safari triggers for all
    // - https://bugs.webkit.org/show_bug.cgi?id=171566
    if (url.indexOf(baseOrigin + '/'))
      script.crossOrigin = 'anonymous';
    script.src = url;
    return script;
  };

  // Auto imports -> script tags can be inlined directly for load phase
  var inlineScriptCount = 0;
  systemJSPrototype.firstImportCallbacks = []

  systemJSPrototype.register = function (deps, declare, autoUrl) {
    var lastAutoImportUrl;
    if (autoUrl) {
      lastAutoImportUrl = autoUrl;
    }
    else if (hasDocument && document.readyState === 'loading' && typeof deps !== 'string') {
      var scripts = document.querySelectorAll('script');
      var lastScript = scripts[scripts.length - 1];
      if (lastScript && lastScript.src) {
        lastAutoImportUrl = lastScript.src;
      }
    }
    if (!lastAutoImportUrl) {
      lastAutoImportUrl = hasDocument && document.currentScript && document.currentScript.src
        ? document.currentScript.src
        : self.location.href + "__inline_script__" + inlineScriptCount;
    }
    var loader = this;
    registerRegistry[lastAutoImportUrl] = [deps, declare];
    return loader.import(lastAutoImportUrl).then(function(namespace) {
      systemJSPrototype.firstImportCallbacks.forEach(function (firstImportCallback) {
        firstImportCallback();
      });
      systemJSPrototype.firstImportCallbacks.length = 0;
      return namespace;
    })
  };

  function getRegister(url, fetchAndExecute) {
    var registration = registerRegistry[url];
    if (registration) {
      return registration;
    }
    var register = systemJSPrototype.register;
    systemJSPrototype.register = function (deps, declare) {
      registerRegistry[url] = [deps, declare];
      register.call(this, deps, declare, url);
    };
    return Promise.resolve(fetchAndExecute()).then(function () {
      systemJSPrototype.register = register;
      return registerRegistry[url];
    }, function (e) {
      systemJSPrototype.register = register;
      return Promise.reject(e);
    });
  }

  var lastWindowErrorUrl, lastWindowError;
  systemJSPrototype.instantiate = function (url, firstParentUrl) {
    return getRegister(url, function() {
      return Promise.resolve(systemJSPrototype.createScript(url)).then(function (script) {
        return new Promise(function (resolve, reject) {
          script.addEventListener('error', function () {
            reject(Error(errMsg(3, [url, firstParentUrl].join(', ') )));
          });
          script.addEventListener('load', function () {
            document.head.removeChild(script);
            // Note that if an error occurs that isn't caught by this if statement,
            // that getRegister will return null and a "did not instantiate" error will be thrown.
            if (lastWindowErrorUrl === url) {
              reject(lastWindowError);
            }
            else {
              resolve();
            }
          });
          document.head.appendChild(script);
        });
      });
    })
  };

  systemJSPrototype.resolve = function (id, parentUrl) {
    parentUrl = parentUrl || !true  || baseUrl;
    return resolveIfNotPlainOrUrl(id, parentUrl) || id || throwUnresolved(id, parentUrl);
  };

  function throwUnresolved (id, parentUrl) {
    throw Error(errMsg(8, [id, parentUrl].join(', ') ));
  }

  /*
   * Supports loading System.register in workers
   */

  if (hasSelf && typeof importScripts === 'function') {
    systemJSPrototype.instantiate = function (url) {
      return getRegister(url, function() {
        return self.fetch(url, {
          credentials: 'same-origin',
        }).then(function (response) {
          if (!response.ok) {
            throw Error(errMsg(7,  [response.status, response.statusText, url].join(', ') ));
          }
          return response.text();
        }).then(function (source) {
          if (source.indexOf('//# sourceURL=') < 0) source += '\n//# sourceURL=' + url;
          (0, eval)(source);
        });
      })
    };
  }

}());

(function () {
  // worker or service worker
  if (typeof WorkerGlobalScope === 'function' && self instanceof WorkerGlobalScope) {
    /*
     * SystemJs loads X files before executing the worker/service worker main file
     * It mean events dispatched during this phase could be missed
     * A warning like the one below is displayed in chrome devtools:
     * "Event handler of 'install' event must be added on the initial evaluation of worker script"
     * To fix that code below listen for these events early and redispatch them later
     * once the worker file is executed (the listeners are installed)
    */
    var isServiceWorker = typeof self.skipWaiting === 'function'
    if (isServiceWorker) {
      // for service worker there is more events to listen
      // and, to get rid of the warning, we override self.addEventListener
      var eventsToCatch = ['message', 'install', 'activate', 'fetch']
      var eventCallbackProxies = {}
      var firstImportPromise = new Promise((resolve) => {
        System.firstImportCallbacks.push(resolve)
      })
      eventsToCatch.forEach(function(eventName) {
        var eventsToDispatch = []
        var eventCallback = function (event) {
          const eventCallbackProxy = eventCallbackProxies[event.type]
          if (eventCallbackProxy) {
            eventCallbackProxy(event)
          }
          else {
            eventsToDispatch.push(event)
            event.waitUntil(firstImportPromise)
          }
        }
        self.addEventListener(eventName, eventCallback)
        System.firstImportCallbacks.push(function() {
          if (eventsToDispatch.length) {
            const eventCallbackProxy = eventCallbackProxies[eventsToDispatch[0].type]
            if (eventCallbackProxy) {
              eventsToDispatch.forEach(function (event) {
                eventCallbackProxy(event)
              })
            }
            eventsToDispatch.length = 0
          }
        })
      })
     
      var addEventListener = self.addEventListener
      self.addEventListener = function (eventName, callback, options) {
        if (eventsToCatch.indexOf(eventName) > -1) {
          eventCallbackProxies[eventName] = callback
          return
        }
        return addEventListener.call(self, eventName, callback, options)
      }
    }
    else {
      var eventsToCatch = ['message']
      eventsToCatch.forEach(function (eventName) {
        var eventQueue = []
        var eventCallback = (event) => {
          eventQueue.push(event)
        }
        self.addEventListener(eventName, eventCallback)
        System.firstImportCallbacks.push(function() {
          self.removeEventListener(eventName, eventCallback)
          eventQueue.forEach(function (event) {
            self.dispatchEvent(event)
          })
          eventQueue.length = 0
        })
      })
    }
  }
}());