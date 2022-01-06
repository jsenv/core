# Browser support

In order to be compatible with as much browsers as possible you need to declare a babel config file as explained in [babel.config.cjs](../../readme.md#babel.config.cjs). This makes your code compatible with the vast majority of web browsers even very old versions of Chrome and Firefox.

## Browser support during development

If your code can run without modification, the dev server behaves like a file server for your source files. Otherwise it transforms source code applying as little modification as possible. Read more in [browser support indicator](../dev_server/readme#browser-support-indicator).

Jsenv relies on web features [listed in the main documentation](../../readme.md#about). At the time of writing this, only Google chrome supports all of them. For this reason it is recommended to use it during development. Using an other browser means dev server applies more transformation to make your code compatible with this browser.

## Browser support during build

During build jsenv applies all babel plugins and other transformations by default. It is also recommended to use systemjs as explained in [SystemJS format](../building/readme.md#SystemJS-format).

If you have a well known list of browsers that you want to support you can tell that to jsenv using "runtimeSupport". "runtimeSupport" will be used to know what needs to be done to make code compatible with these runtimes. For instance it is used to enable or disable some babel plugins.

```diff
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryRelativeUrl: "dist",
  entryPoints: {
    "./file.js": "file.js",
  },
  format: "systemjs",
+  runtimeSupport: {
+    chrome: "55",
+    edge: "14",
+    firefox: "52",
+    safari: "11",
+  },
})
```

_file.js:_

```js
const value = await Promise.resolve(42)
console.log(value)
```

_dist/file.js:_

```js
System.register([], function () {
  "use strict"
  return {
    execute: async function () {
      const value = await Promise.resolve(42)
      console.log(value)
    },
  }
})
//# sourceMappingURL=file.js.map
```

<details>
    <summary>See dist/file.js when "runtimeSupport" is undefined</summary>

```js
function _await(value, then, direct) {
  if (direct) {
    return then ? then(value) : value
  }

  if (!value || !value.then) {
    value = Promise.resolve(value)
  }

  return then ? value.then(then) : value
}

function _async(f) {
  return function () {
    for (var args = [], i = 0; i < arguments.length; i++) {
      args[i] = arguments[i]
    }

    try {
      return Promise.resolve(f.apply(this, args))
    } catch (e) {
      return Promise.reject(e)
    }
  }
}

System.register([], function () {
  "use strict"

  return {
    execute: _async(function () {
      return _await(Promise.resolve(42), function (value) {
        console.log(value)
      })
    }),
  }
})
//# sourceMappingURL=file.js.map
```

</details>
