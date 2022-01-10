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

That's all you need when the package has a js module export. If the package only have a CommonJS or UMD export you need a little more as documented below.

## Using a package written in CommonJS

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

## Using a package written in UMD

```js
import "jquery"

const jquery = window.$
```
