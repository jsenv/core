# Browser support

Jsenv browser support splits into "during dev" and "after build".
By default support after build is the same as during dev. 
But support after build can be extended by configuration.
The table below presents the largest support that can be obtained.

| Browser           | During dev | After build |
| ----------------- | ---------- | ----------- |
| Chrome            | 64+        | 7+          |
| Safari            | 11.3+      | 5.1+        |
| Edge              | 79+        | 12+         |
| Firefox           | 67+        | 2+          |
| Opera             | 51+        | 12+         |
| Internet Explorer | ---        | ---         |
| Safari on IOS     | 12+        | 6+          |
| Samsung Internet  | 9.2+       | 1+          |

# Browser support during development

Using a browser not matching the browser support during dev means it will likely be unable to run the code.

If you need to reproduce what happens for people using old browsers:

1. Generate a build first (usually `npm run build`)
2. Start a server for build files (usually `npm run build:serve`)

# Browser support after build

As said before, by default support after build is the same as during dev.
If you need to support older browsers you must use a parameter called "runtimeCompat".

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

Many transformations are performed to ensure the code generated will be compatible, **only if needed**:

- Transforming `<script type="module"></script>` into `<script></script>`
- Transforming `import` and `export`
- Transforming `async` and `await` into promises
- And many more...

## Polyfills

Jsenv do not handle polyfills.

For example to be compatible with browsers that do not support Promise,
the Promise polyfill must be added (suggestion: using https://polyfill.io)
