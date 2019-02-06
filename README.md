# dev-server

- follow up https://github.com/systemjs/systemjs/issues/1898

- first version of compile function

  - it should create a node file that can be consumed like that:

    ```js
    const modulePromise = require("using-jsenv/dist/node-main.js")
    modulePromise.then((namespace) => {})
    ```

  - it should create a browser file that can be consumed like that:

    ```html
    <script src="node_modules/using-jsenv/dist/browser-main.js"></script>
    <script>
      window.modulePromise.then((namespace) => {})
    </script>
    ```

    of course window.modulePromise is configurable to avoid clash
    and could be something like `window.__assertModulePromise__`

    keep in mind `using-jsenv/dist/browser-main.js` must consider
    remoteRoot as being `${window.origin}/node_modules/using-jsenv`
    instead of winodw.origin
    so it needs a way to know where he is.
    it could detect the script tag or consider by default
    that it will be inside `node_modules/moduleName/dist/browser-main.js`
    and compute remoteRoot accordingly

- update code, especially browserPlatform to avoid thinking we can avoid

  Systemjs when browser/node supports import/export syntax.
  This is not true because of

  - top level await
  - custom module resolution (absolute moduleSpecifier relative to node module or project)
  - how we plan to avoid http request using system registry as first step
