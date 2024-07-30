# script_type_module_basic.md

## 0_js_module

```js
build({
  ...testParams,
  runtimeCompat: { chrome: "89" },
})
```

### 1/6 terminal

```console

build "./main.html"
⠋ generate source graph

```

### 2/6 return promise

### 3/6 terminal

![img](0_js_module/0_js_module_log_group.svg)

### 4/6 write 2 files into "./build/"

<details>
  <summary>details</summary>

## js/main.js
```js
console.log(42);

```

## main.html
```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8">
  </head>

  <body>
    <script type="module" src="/js/main.js"></script>
  </body>
</html>
```

</details>

### 5/6 terminal

![img](0_js_module/0_js_module_log_group.svg)

### 6/6 resolve

```js
{
  "buildInlineContents": {},
  "buildManifest": {}
}
```

## 1_js_module_fallback

```js
build({
  ...testParams,
  runtimeCompat: { chrome: "60" },
})
```

### 1/6 terminal

```console

build "./main.html"
⠋ generate source graph

```

### 2/6 return promise

### 3/6 terminal

![img](1_js_module_fallback/1_js_module_fallback_log_group.svg)

### 4/6 write 2 files into "./build/"

<details>
  <summary>details</summary>

## js/main.nomodule.js
```js
System.register([], function (_export, _context) {
  "use strict";

  return {
    setters: [],
    execute: function () {
      console.log(42);
    }
  };
});
```

## main.html
```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8">
    <script>
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
      
      (function () {
        /* eslint-env browser */
      
        const loadRegistry = Object.create(null);
        const registerRegistry = Object.create(null);
        let inlineScriptCount = 0;
        const System = {};
        const hasDocument = typeof document === "object";
        const envGlobal = self;
        const isWorker = !hasDocument && typeof envGlobal.WorkerGlobalScope === "function" && envGlobal instanceof envGlobal.WorkerGlobalScope;
        const isServiceWorker = isWorker && typeof self.skipWaiting === "function";
        envGlobal.System = System;
        let baseUrl = envGlobal.location.href.split("#")[0].split("?")[0];
        const lastSlashIndex = baseUrl.lastIndexOf("/");
        if (lastSlashIndex !== -1) {
          baseUrl = baseUrl.slice(0, lastSlashIndex + 1);
        }
        const resolveUrl = (specifier, baseUrl) => new URL(specifier, baseUrl).href;
        if (hasDocument) {
          const baseElement = document.querySelector("base[href]");
          if (baseElement) {
            baseUrl = baseElement.href;
          }
          System.register = (deps, declare) => {
            if (!document.currentScript) {
              throw new Error("unexpected call to System.register (document.currentScript is undefined)");
            }
            if (document.currentScript.__s__) {
              registerRegistry[document.currentScript.src] = [deps, declare];
              return null;
            }
            const url = document.currentScript.src || `${window.location.href}__inline_script__${++inlineScriptCount}`;
            registerRegistry[url] = [deps, declare];
            return _import(url);
          };
          System.instantiate = url => {
            const script = createScript(url);
            return new Promise(function (resolve, reject) {
              let lastWindowErrorUrl;
              let lastWindowError;
              const windowErrorCallback = event => {
                lastWindowErrorUrl = event.filename;
                lastWindowError = event.error;
              };
              window.addEventListener("error", windowErrorCallback);
              script.addEventListener("error", () => {
                window.removeEventListener("error", windowErrorCallback);
                reject(`An error occured while loading url with <script> for ${url}`);
              });
              script.addEventListener("load", () => {
                window.removeEventListener("error", windowErrorCallback);
                document.head.removeChild(script);
                // Note that if an error occurs that isn't caught by this if statement,
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
          const createScript = url => {
            const script = document.createElement("script");
            script.async = true;
            // Only add cross origin for actual cross origin
            // this is because Safari triggers for all
            // - https://bugs.webkit.org/show_bug.cgi?id=171566
            if (url.indexOf(`${self.location.origin}/`)) {
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
          const firstImportCallbacks = [];
          if (isServiceWorker) {
            // for service worker there is more events to listen
            // and, to get rid of the warning, we override self.addEventListener
            const eventsToCatch = ["message", "install", "activate", "fetch"];
            const eventCallbackProxies = {};
            const firstImportPromise = new Promise(resolve => {
              firstImportCallbacks.push(resolve);
            });
            eventsToCatch.forEach(eventName => {
              const eventsToDispatch = [];
              const eventCallback = event => {
                const eventCallbackProxy = eventCallbackProxies[event.type];
                if (eventCallbackProxy) {
                  eventCallbackProxy(event);
                } else {
                  eventsToDispatch.push(event);
                  event.waitUntil(firstImportPromise);
                }
              };
              self.addEventListener(eventName, eventCallback);
              firstImportCallbacks.push(() => {
                if (eventsToDispatch.length) {
                  const eventCallbackProxy = eventCallbackProxies[eventsToDispatch[0].type];
                  if (eventCallbackProxy) {
                    eventsToDispatch.forEach(event => {
                      eventCallbackProxy(event);
                    });
                  }
                  eventsToDispatch.length = 0;
                }
              });
            });
            const addEventListener = self.addEventListener;
            self.addEventListener = function (eventName, callback, options) {
              if (eventsToCatch.indexOf(eventName) > -1) {
                eventCallbackProxies[eventName] = callback;
                return null;
              }
              return addEventListener.call(self, eventName, callback, options);
            };
          } else {
            const eventsToCatch = ["message"];
            eventsToCatch.forEach(eventName => {
              var eventQueue = [];
              var eventCallback = event => {
                eventQueue.push(event);
              };
              self.addEventListener(eventName, eventCallback);
              firstImportCallbacks.push(() => {
                self.removeEventListener(eventName, eventCallback);
                eventQueue.forEach(function (event) {
                  self.dispatchEvent(event);
                });
                eventQueue.length = 0;
              });
            });
          }
          System.register = async (deps, declare) => {
            System.register = () => {
              throw new Error("unexpected call to System.register (called outside url instantiation)");
            };
            const url = self.location.href;
            registerRegistry[url] = [deps, declare];
            const namespace = await _import(url);
            firstImportCallbacks.forEach(firstImportCallback => {
              firstImportCallback();
            });
            firstImportCallbacks.length = 0;
            return namespace;
          };
          System.instantiate = async url => {
            const response = await self.fetch(url, {
              credentials: "same-origin"
            });
            if (!response.ok) {
              throw Error(`Failed to fetch module at ${url}`);
            }
            let source = await response.text();
            if (source.indexOf("//# sourceURL=") < 0) {
              source += `\n//# sourceURL=${url}`;
            }
            const register = System.register;
            System.register = (deps, declare) => {
              registerRegistry[url] = [deps, declare];
            };
            (0, self.eval)(source);
            System.register = register;
          };
        }
        const _import = (specifier, parentUrl) => {
          const url = resolveUrl(specifier, parentUrl);
          const load = getOrCreateLoad(url, parentUrl);
          if (load.completionPromise) {
            if (load.completionPromise === load.namespace) {
              return Promise.resolve(load.namespace);
            }
            return load.completionPromise;
          }
          return startExecution(load, parentUrl);
        };
        const getOrCreateLoad = (url, firstParentUrl) => {
          const existingLoad = loadRegistry[url];
          if (existingLoad) {
            return existingLoad;
          }
          const namespace = createNamespace();
          const load = {
            url,
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
            namespace
          };
          loadRegistry[url] = load;
          load.instantiatePromise = (async () => {
            try {
              let registration = registerRegistry[url];
              if (!registration) {
                const instantiateReturnValue = System.instantiate(url, firstParentUrl);
                if (instantiateReturnValue) {
                  await instantiateReturnValue;
                }
                registration = registerRegistry[url];
              }
              if (!registration) {
                throw new Error(`System.register() not called after executing ${url}`);
              }
              const _export = (firstArg, secondArg) => {
                load.hoistedExports = true;
                let changed = false;
                if (typeof firstArg === "string") {
                  const name = firstArg;
                  const value = secondArg;
                  if (!(name in namespace) || namespace[name] !== value) {
                    namespace[name] = value;
                    changed = true;
                  }
                } else {
                  Object.keys(firstArg).forEach(name => {
                    const value = firstArg[name];
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
                  load.importerSetters.forEach(importerSetter => {
                    if (importerSetter) {
                      importerSetter(namespace);
                    }
                  });
                }
                return secondArg;
              };
              const [deps, declare] = registration;
              const {
                setters,
                execute = () => {}
              } = declare(_export, {
                import: importId => _import(importId, url),
                meta: createMeta(url)
              });
              load.deps = deps;
              load.setters = setters;
              load.execute = execute;
            } catch (e) {
              load.error = e;
              load.execute = null;
            }
          })();
          load.linkPromise = (async () => {
            await load.instantiatePromise;
            const dependencyLoads = await Promise.all(load.deps.map(async (dep, index) => {
              const setter = load.setters[index];
              const dependencyUrl = resolveUrl(dep, url);
              const dependencyLoad = getOrCreateLoad(dependencyUrl, url);
              if (dependencyLoad.instantiatePromise) {
                await dependencyLoad.instantiatePromise;
              }
              if (setter) {
                dependencyLoad.importerSetters.push(setter);
                if (dependencyLoad.hoistedExports || !dependencyLoad.instantiatePromise) {
                  setter(dependencyLoad.namespace);
                }
              }
              return dependencyLoad;
            }));
            load.dependencyLoads = dependencyLoads;
          })();
          return load;
        };
        const startExecution = async (load, importerUrl) => {
          load.completionPromise = (async () => {
            await instantiateAll(load, load, {});
            await postOrderExec(load, importerUrl ? [importerUrl] : []);
            return load.namespace;
          })();
          return load.completionPromise;
        };
        const instantiateAll = async (load, parent, loaded) => {
          if (loaded[load.url]) {
            return;
          }
          loaded[load.url] = true;
          try {
            if (load.linkPromise) {
              // load.linkPromise is null once instantiated
              await load.linkPromise;
            }
            await Promise.all(load.dependencyLoads.map(dependencyLoad => {
              return instantiateAll(dependencyLoad, parent, loaded);
            }));
          } catch (error) {
            if (load.error) {
              throw error;
            }
            load.execute = null;
            throw error;
          }
        };
        const postOrderExec = (load, importStack) => {
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
          }
      
          // deps execute first, unless circular
          const execute = load.execute;
          load.execute = null;
          const depLoadPromises = [];
          load.dependencyLoads.forEach(dependencyLoad => {
            try {
              const depImportStack = importStack.slice();
              depImportStack.push(load.url);
              const depLoadPromise = postOrderExec(dependencyLoad, depImportStack);
              if (depLoadPromise) {
                depLoadPromises.push(depLoadPromise);
              }
            } catch (err) {
              load.error = err;
              throw err;
            }
          });
          return (async () => {
            if (depLoadPromises.length) {
              const allDepPromise = Promise.all(depLoadPromises);
              await allDepPromise;
            }
            try {
              const executeReturnValue = execute.call(nullContext);
              if (executeReturnValue) {
                load.executePromise = executeReturnValue.then(() => {
                  load.executePromise = null;
                  load.completionPromise = load.namespace;
                }, error => {
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
          })();
        };
      
        // the closest we can get to call(undefined)
        const nullContext = Object.freeze(Object.create(null));
        const createMeta = url => {
          return {
            url,
            resolve: id => resolveUrl(id, url)
          };
        };
        const createNamespace = typeof Symbol !== "undefined" && Symbol.toStringTag ? () => {
          const namespace = Object.create(null);
          Object.defineProperty(namespace, Symbol.toStringTag, {
            value: "Module"
          });
          return namespace;
        } : () => Object.create(null);
      })();
    </script>
  </head>

  <body>
    <script src="/js/main.nomodule.js"></script>
  </body>
</html>
```

</details>

### 5/6 terminal

![img](1_js_module_fallback/1_js_module_fallback_log_group.svg)

### 6/6 resolve

<details>
  <summary>details</summary>

```js
{
  "buildInlineContents": {
    "main.html@s.js": "/*\n * This file is a modified version of https://github.com/systemjs/systemjs/blob/main/dist/s.js/n * with the following changes:\n *\n * - Code can use aync/await, const, etc because this file is compiled (see dist/s.js)\n * - Can use document.currentScript because we don't support IE\n * - auto import inline System.register\n * - auto import first System.register in web workers\n * - queing events in web workers\n * - no support for importmap because jsenv don't need it\n */\n\n(function () {\n  /* eslint-env browser */\n\n  const loadRegistry = Object.create(null);\n  const registerRegistry = Object.create(null);\n  let inlineScriptCount = 0;\n  const System = {};\n  const hasDocument = typeof document === \"object\";\n  const envGlobal = self;\n  const isWorker = !hasDocument && typeof envGlobal.WorkerGlobalScope === \"function\" && envGlobal instanceof envGlobal.WorkerGlobalScope;\n  const isServiceWorker = isWorker && typeof self.skipWaiting === \"function\";\n  envGlobal.System = System;\n  let baseUrl = envGlobal.location.href.split(\"#\")[0].split(\"?\")[0];\n  const lastSlashIndex = baseUrl.lastIndexOf(\"/\");\n  if (lastSlashIndex !== -1) {\n    baseUrl = baseUrl.slice(0, lastSlashIndex + 1);\n  }\n  const resolveUrl = (specifier, baseUrl) => new URL(specifier, baseUrl).href;\n  if (hasDocument) {\n    const baseElement = document.querySelector(\"base[href]\");\n    if (baseElement) {\n      baseUrl = baseElement.href;\n    }\n    System.register = (deps, declare) => {\n      if (!document.currentScript) {\n        throw new Error(\"unexpected call to System.register (document.currentScript is undefined)\");\n      }\n      if (document.currentScript.__s__) {\n        registerRegistry[document.currentScript.src] = [deps, declare];\n        return null;\n      }\n      const url = document.currentScript.src || `${window.location.href}__inline_script__${++inlineScriptCount}`;\n      registerRegistry[url] = [deps, declare];\n      return _import(url);\n    };\n    System.instantiate = url => {\n      const script = createScript(url);\n      return new Promise(function (resolve, reject) {\n        let lastWindowErrorUrl;\n        let lastWindowError;\n        const windowErrorCallback = event => {\n          lastWindowErrorUrl = event.filename;\n          lastWindowError = event.error;\n        };\n        window.addEventListener(\"error\", windowErrorCallback);\n        script.addEventListener(\"error\", () => {\n          window.removeEventListener(\"error\", windowErrorCallback);\n          reject(`An error occured while loading url with <script> for ${url}`);\n        });\n        script.addEventListener(\"load\", () => {\n          window.removeEventListener(\"error\", windowErrorCallback);\n          document.head.removeChild(script);\n          // Note that if an error occurs that isn't caught by this if statement,\n          // that getRegister will return null and a \"did not instantiate\" error will be thrown.\n          if (lastWindowErrorUrl === url) {\n            reject(lastWindowError);\n          } else {\n            resolve();\n          }\n        });\n        document.head.appendChild(script);\n      });\n    };\n    const createScript = url => {\n      const script = document.createElement(\"script\");\n      script.async = true;\n      // Only add cross origin for actual cross origin\n      // this is because Safari triggers for all\n      // - https://bugs.webkit.org/show_bug.cgi?id=171566\n      if (url.indexOf(`${self.location.origin}/`)) {\n        script.crossOrigin = \"anonymous\";\n      }\n      script.__s__ = true;\n      script.src = url;\n      return script;\n    };\n  }\n  if (isWorker) {\n    /*\n     * SystemJs loads X files before executing the worker/service worker main file\n     * It mean events dispatched during this phase could be missed\n     * A warning like the one below is displayed in chrome devtools:\n     * \"Event handler of 'install' event must be added on the initial evaluation of worker script\"\n     * To fix that code below listen for these events early and redispatch them later\n     * once the worker file is executed (the listeners are installed)\n     */\n    const firstImportCallbacks = [];\n    if (isServiceWorker) {\n      // for service worker there is more events to listen\n      // and, to get rid of the warning, we override self.addEventListener\n      const eventsToCatch = [\"message\", \"install\", \"activate\", \"fetch\"];\n      const eventCallbackProxies = {};\n      const firstImportPromise = new Promise(resolve => {\n        firstImportCallbacks.push(resolve);\n      });\n      eventsToCatch.forEach(eventName => {\n        const eventsToDispatch = [];\n        const eventCallback = event => {\n          const eventCallbackProxy = eventCallbackProxies[event.type];\n          if (eventCallbackProxy) {\n            eventCallbackProxy(event);\n          } else {\n            eventsToDispatch.push(event);\n            event.waitUntil(firstImportPromise);\n          }\n        };\n        self.addEventListener(eventName, eventCallback);\n        firstImportCallbacks.push(() => {\n          if (eventsToDispatch.length) {\n            const eventCallbackProxy = eventCallbackProxies[eventsToDispatch[0].type];\n            if (eventCallbackProxy) {\n              eventsToDispatch.forEach(event => {\n                eventCallbackProxy(event);\n              });\n            }\n            eventsToDispatch.length = 0;\n          }\n        });\n      });\n      const addEventListener = self.addEventListener;\n      self.addEventListener = function (eventName, callback, options) {\n        if (eventsToCatch.indexOf(eventName) > -1) {\n          eventCallbackProxies[eventName] = callback;\n          return null;\n        }\n        return addEventListener.call(self, eventName, callback, options);\n      };\n    } else {\n      const eventsToCatch = [\"message\"];\n      eventsToCatch.forEach(eventName => {\n        var eventQueue = [];\n        var eventCallback = event => {\n          eventQueue.push(event);\n        };\n        self.addEventListener(eventName, eventCallback);\n        firstImportCallbacks.push(() => {\n          self.removeEventListener(eventName, eventCallback);\n          eventQueue.forEach(function (event) {\n            self.dispatchEvent(event);\n          });\n          eventQueue.length = 0;\n        });\n      });\n    }\n    System.register = async (deps, declare) => {\n      System.register = () => {\n        throw new Error(\"unexpected call to System.register (called outside url instantiation)\");\n      };\n      const url = self.location.href;\n      registerRegistry[url] = [deps, declare];\n      const namespace = await _import(url);\n      firstImportCallbacks.forEach(firstImportCallback => {\n        firstImportCallback();\n      });\n      firstImportCallbacks.length = 0;\n      return namespace;\n    };\n    System.instantiate = async url => {\n      const response = await self.fetch(url, {\n        credentials: \"same-origin\"\n      });\n      if (!response.ok) {\n        throw Error(`Failed to fetch module at ${url}`);\n      }\n      let source = await response.text();\n      if (source.indexOf(\"//# sourceURL=\") < 0) {\n        source += `\\n//# sourceURL=${url}`;\n      }\n      const register = System.register;\n      System.register = (deps, declare) => {\n        registerRegistry[url] = [deps, declare];\n      };\n      (0, self.eval)(source);\n      System.register = register;\n    };\n  }\n  const _import = (specifier, parentUrl) => {\n    const url = resolveUrl(specifier, parentUrl);\n    const load = getOrCreateLoad(url, parentUrl);\n    if (load.completionPromise) {\n      if (load.completionPromise === load.namespace) {\n        return Promise.resolve(load.namespace);\n      }\n      return load.completionPromise;\n    }\n    return startExecution(load, parentUrl);\n  };\n  const getOrCreateLoad = (url, firstParentUrl) => {\n    const existingLoad = loadRegistry[url];\n    if (existingLoad) {\n      return existingLoad;\n    }\n    const namespace = createNamespace();\n    const load = {\n      url,\n      deps: [],\n      dependencyLoads: [],\n      instantiatePromise: null,\n      linkPromise: null,\n      executePromise: null,\n      completionPromise: null,\n      importerSetters: [],\n      setters: [],\n      execute: null,\n      error: null,\n      hoistedExports: false,\n      namespace\n    };\n    loadRegistry[url] = load;\n    load.instantiatePromise = (async () => {\n      try {\n        let registration = registerRegistry[url];\n        if (!registration) {\n          const instantiateReturnValue = System.instantiate(url, firstParentUrl);\n          if (instantiateReturnValue) {\n            await instantiateReturnValue;\n          }\n          registration = registerRegistry[url];\n        }\n        if (!registration) {\n          throw new Error(`System.register() not called after executing ${url}`);\n        }\n        const _export = (firstArg, secondArg) => {\n          load.hoistedExports = true;\n          let changed = false;\n          if (typeof firstArg === \"string\") {\n            const name = firstArg;\n            const value = secondArg;\n            if (!(name in namespace) || namespace[name] !== value) {\n              namespace[name] = value;\n              changed = true;\n            }\n          } else {\n            Object.keys(firstArg).forEach(name => {\n              const value = firstArg[name];\n              if (!(name in namespace) || namespace[name] !== value) {\n                namespace[name] = value;\n                changed = true;\n              }\n            });\n            if (firstArg && firstArg.__esModule) {\n              namespace.__esModule = firstArg.__esModule;\n            }\n          }\n          if (changed) {\n            load.importerSetters.forEach(importerSetter => {\n              if (importerSetter) {\n                importerSetter(namespace);\n              }\n            });\n          }\n          return secondArg;\n        };\n        const [deps, declare] = registration;\n        const {\n          setters,\n          execute = () => {}\n        } = declare(_export, {\n          import: importId => _import(importId, url),\n          meta: createMeta(url)\n        });\n        load.deps = deps;\n        load.setters = setters;\n        load.execute = execute;\n      } catch (e) {\n        load.error = e;\n        load.execute = null;\n      }\n    })();\n    load.linkPromise = (async () => {\n      await load.instantiatePromise;\n      const dependencyLoads = await Promise.all(load.deps.map(async (dep, index) => {\n        const setter = load.setters[index];\n        const dependencyUrl = resolveUrl(dep, url);\n        const dependencyLoad = getOrCreateLoad(dependencyUrl, url);\n        if (dependencyLoad.instantiatePromise) {\n          await dependencyLoad.instantiatePromise;\n        }\n        if (setter) {\n          dependencyLoad.importerSetters.push(setter);\n          if (dependencyLoad.hoistedExports || !dependencyLoad.instantiatePromise) {\n            setter(dependencyLoad.namespace);\n          }\n        }\n        return dependencyLoad;\n      }));\n      load.dependencyLoads = dependencyLoads;\n    })();\n    return load;\n  };\n  const startExecution = async (load, importerUrl) => {\n    load.completionPromise = (async () => {\n      await instantiateAll(load, load, {});\n      await postOrderExec(load, importerUrl ? [importerUrl] : []);\n      return load.namespace;\n    })();\n    return load.completionPromise;\n  };\n  const instantiateAll = async (load, parent, loaded) => {\n    if (loaded[load.url]) {\n      return;\n    }\n    loaded[load.url] = true;\n    try {\n      if (load.linkPromise) {\n        // load.linkPromise is null once instantiated\n        await load.linkPromise;\n      }\n      await Promise.all(load.dependencyLoads.map(dependencyLoad => {\n        return instantiateAll(dependencyLoad, parent, loaded);\n      }));\n    } catch (error) {\n      if (load.error) {\n        throw error;\n      }\n      load.execute = null;\n      throw error;\n    }\n  };\n  const postOrderExec = (load, importStack) => {\n    if (importStack.indexOf(load.url) > -1) {\n      return undefined;\n    }\n    if (!load.execute) {\n      if (load.error) {\n        throw load.error;\n      }\n      if (load.executePromise) {\n        return load.executePromise;\n      }\n      return undefined;\n    }\n\n    // deps execute first, unless circular\n    const execute = load.execute;\n    load.execute = null;\n    const depLoadPromises = [];\n    load.dependencyLoads.forEach(dependencyLoad => {\n      try {\n        const depImportStack = importStack.slice();\n        depImportStack.push(load.url);\n        const depLoadPromise = postOrderExec(dependencyLoad, depImportStack);\n        if (depLoadPromise) {\n          depLoadPromises.push(depLoadPromise);\n        }\n      } catch (err) {\n        load.error = err;\n        throw err;\n      }\n    });\n    return (async () => {\n      if (depLoadPromises.length) {\n        const allDepPromise = Promise.all(depLoadPromises);\n        await allDepPromise;\n      }\n      try {\n        const executeReturnValue = execute.call(nullContext);\n        if (executeReturnValue) {\n          load.executePromise = executeReturnValue.then(() => {\n            load.executePromise = null;\n            load.completionPromise = load.namespace;\n          }, error => {\n            load.executePromise = null;\n            load.error = error;\n            throw error;\n          });\n          return;\n        }\n        load.instantiatePromise = null;\n        load.linkPromise = null;\n        load.completionPromise = load.namespace;\n      } catch (error) {\n        load.error = error;\n        throw error;\n      } finally {\n        load.execute = null;\n      }\n    })();\n  };\n\n  // the closest we can get to call(undefined)\n  const nullContext = Object.freeze(Object.create(null));\n  const createMeta = url => {\n    return {\n      url,\n      resolve: id => resolveUrl(id, url)\n    };\n  };\n  const createNamespace = typeof Symbol !== \"undefined\" && Symbol.toStringTag ? () => {\n    const namespace = Object.create(null);\n    Object.defineProperty(namespace, Symbol.toStringTag, {\n      value: \"Module\"\n    });\n    return namespace;\n  } : () => Object.create(null);\n})();"
  },
  "buildManifest": {}
}
```

</details>

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a> executing <a href="../../../../snapshot_build_side_effects.js">../../../../snapshot_build_side_effects.js</a>
</sub>