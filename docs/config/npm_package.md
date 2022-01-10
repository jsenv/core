# Using a NPM package

The way to use a NPM package depend how it's written, especially what is exported by this package.

There is two things to do:

1 - Remap "bare specifier" to an actual file using an importmap
2 - Eventually adapt to the module format used by the package

## Mapping bare specifier

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf8" />
    <link rel="icon" href="data:," />
  </head>
  <body>
    <script type="module">
      import { v4 as uuidv4 } from "uuid"

      uuidv4()
    </script>
  </body>
</html>
```

The code above uses the "uuid" node module. If browser execute the HTML file as it is it would fail because "uuid" does not lead to a file. This can be fixed using an importmap script to remap "uuid" to an actual file.

```diff
+ <script type="importmap">
+  {
+    "imports": {
+      "uuid": "./dist/esm-browser/index.js"
+    }
+  }
+</script>
```

These mappings can be generated automatically using [@jsenv/node-module-import-map](https://github.com/jsenv/jsenv-node-module-import-map#node-module-import-map).

Read more about importmap at https://github.com/WICG/import-maps#import-maps.

## Use package written with import/export

In theory you're good to go.

But, if the NPM package omit import extensions use [@jsenv/node-module-import-map](https://github.com/jsenv/jsenv-node-module-import-map#node-module-import-map) to generate mappings for these imports.

## Use package written in CommonJS

Assuming you import code from a package written in CommonJS.

```html
<script type="module">
  import something from "package-written-in-commonjs"

  console.log(something)
</script>
```

A browser cannot execute code written in CommonJS, it was invented by and for Node.js. You need to use "customCompilers" and "commonJsToJavaScriptModule" to convert code to js modules.

In _jsenv.config.mjs_:

```js
import { commonJsToJavaScriptModule } from "@jsenv/core"

export const customCompilers = {
  "./node_modules/package-written-in-commonjs/**/*.js":
    commonJsToJavaScriptModule,
}
```

## Use package written in UMD

```js
import "jquery"

const jquery = window.$
```
