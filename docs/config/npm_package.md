# Using a NPM package

Let's say you want to execute the following HTML using a package called "amazing-package".

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf8" />
    <link rel="icon" href="data:," />
  </head>
  <body>
    <script type="module">
      import { doSomethingAmazing } from "amazing-package"

      doSomethingAmazing()
    </script>
  </body>
</html>
```

You need to do the following:

1. Check package exports
2. Remap package with importmap
3. Adapt to the module format

## 1. Check package exports

The way to use a NPM package depends on how it's written. Especially the file you will import from this package.

Check the files exported by the package, how they are written and deduce the module format.

| Code found in the file      | Module format |
| --------------------------- | ------------- |
| `import`, `export`          | ESModule      |
| `require`, `module.exports` | CommonJS      |
| `window.name = value`       | Global        |

If several format are available, choose the one you want to use.

## 2. Remap package with importmap

If browser executes the HTML file as it is, it would fail because "amazing-package" is not a file. This can be fixed using an importmap script to remap "amazing-package" to the file you want to use.

```diff
+ <script type="importmap">
+  {
+    "imports": {
+      "amazing-package": "./index.js"
+    }
+  }
+</script>
```

These mappings can be generated automatically using [@jsenv/node-module-import-map](https://github.com/jsenv/jsenv-node-module-import-map#node-module-import-map).

Read more about importmap at https://github.com/WICG/import-maps#import-maps.

## 3. Adapt to the module format

According to module format deduced at step 1, do one of the following:

- ESModule

  For most cases you're good to go.

  But, if the NPM package contains import without file extensions, use [@jsenv/node-module-import-map](https://github.com/jsenv/jsenv-node-module-import-map#node-module-import-map)
  with "magicExtensions" enabled.

- CommonJS

  A browser cannot execute code written in CommonJS, it was invented by and for Node.js. You need to convert code to import/export.

  In _jsenv.config.mjs_:

  ```js
  import { commonJsToJavaScriptModule } from "@jsenv/core"

  export const customCompilers = {
    "./node_modules/amazing-package/**/*.js": commonJsToJavaScriptModule,
  }
  ```

- Global

  Import and simply read what was written on `window`. See the example below applied to jQuery.

  ```js
  import "jquery"

  const jquery = window.$
  ```
