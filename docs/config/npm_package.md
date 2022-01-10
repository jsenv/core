# Using a NPM package

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

The code above uses the "cuid" node module. If browser execute this HTML file as it is it would fail because "cuid" does not lead to a file. This can be fixed using an importmap script to remap "uuid" to an actual file.

```diff
+ <script type="importmap">
+  {
+    "imports": {
+      "uuid": "./dist/esm-browser/index.js"
+    }
+  }
+</script>
```

These mappings can generated automatically using [@jsenv/node-module-import-map](https://github.com/jsenv/jsenv-node-module-import-map#node-module-import-map).

Read more about importmap at https://github.com/WICG/import-maps#import-maps.

This works if the package you want to use provide a js module export. Otherwise check how to use CommonJS and UMD packages below.

## Using a package written in CommonJS

CommonJS is a module format using `module.exports` and `require`. A browser cannot execute code written in CommonJS, it was invented by and for Node.js.

If you import code from a package written in CommonJS you need to use "customCompilers" and "commonJsToJavaScriptModule" to convert it.

```html
<script type="module">
  import something from "package-written-in-commonjs"

  console.log(something)
</script>
```

In _jsenv.config.mjs_:

```js
import { commonJsToJavaScriptModule } from "@jsenv/core"

export const customCompilers = {
  "./node_modules/package-written-in-commonjs/**/*.js":
    commonJsToJavaScriptModule,
}
```

## Using a package written in UMD

```js
import "jquery"

const jquery = window.$
```
