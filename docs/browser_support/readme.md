# Browser support

When your code cannot be runned directly by one of the browser you want to support you need to configure a "runtimeCompat".

## Browser support during development

Jsenv dev server transforms your source code according to the browser requesting it. In other words if you use a recent chrome during development, dev server will apply zero or very few transformations to your source code.

If you use a very old browser to request the dev server, features like Hot Module reloading won't work. Internet explorer is not supported.

## Browser support during build

By default jsenv assumes you want to generated code compatible with browsers having the following features:

- `<script type="module"></script>`
- dynamic import
- `import.meta`

This translates into the following [runtimeCompat](https://github.com/jsenv/jsenv-core/blob/b0eb801554ab4fce2fbe2eafbb7f726d7f3486e2/src/build/build.js#L91-L100)

If you want to support older browsers you can provide your own "runtimeCompat".

```diff
import { build } from "@jsenv/core"

await build({
  rootDirectoryUrl: new URL("../", import.meta.url),
  buildDirectoryUrl:new URL("../dist/", import.meta.url),
  entryPoints: {
    "./src/main.html": "index.html",
  },
+  runtimeCompat: {
+    chrome: "55",
+    edge: "15",
+    firefox: "52",
+    safari: "11",
+  },
})
```

If some browser in your runtimeCompat do not support `<script type="module"></script>` the JS will be converted to become compatible. Many other transformations are performed to ensure the code generated will be compatible.

- Jsenv do not handle polyfills, you can use a service like https://polyfill.io
- Internet Explorer is not supported
