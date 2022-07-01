# Url resolution

This documentation explains jsenv behaviour regarding url resolution.

- Short explanation: like a browser would + a bit more for js modules
- Long explanation: the rest of this document

## Full path specifier

It's recommended to prefer leading slash url specifiers over `"../"`

```diff
-  background-image: url(../../logo.png);
+  background-image: url(/src/logo.png);
```

- :+1: create consistent specifiers
- :+1: escape `"../../"` hell.

## Url resolution outside js module

Outside js module urls are resolved by the standard url resolution: `new URL(specifier, baseUrl)`.

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="./favicon.ico" />
    <link rel="stylesheet" type="text/css" href="./main.css" />
    <style>
      body {
        background-image: url(/src/logo.png);
      }
    </style>
  </head>
  <body>
    Hello world
  </body>
</html>
```

### Url resolution inside js modules

Inside js modules url resolution is augmented with [Node ESM resolution algorithm](#node-esm-resolution-algorithm) and [FileSystem magic resolution](#filesystem-magic-resolution)

#### Node ESM resolution algorithm

Without it, the code below would throw in a browser:

```js
import "amazing-package"
```

To be compatible with browsers, "amazing-package" must be resolved and transformed into:

```js
import "/node_modules/amazing-package/index.js"
```

Jsenv does this by default. 
Moreover, the whole Node ESM resolution is implemented so the following logic can be used:

- [Self referencing a package using its name](https://nodejs.org/docs/latest-v18.x/api/packages.html#self-referencing-a-package-using-its-name)
- [Subpath exports](https://nodejs.org/docs/latest-v18.x/api/packages.html#subpath-exports)
- [Subpath imports](https://nodejs.org/docs/latest-v18.x/api/packages.html#subpath-imports)

If you don't use NPM packages you can disable node esm resolution

```diff
import { startDevServer } from "@jsenv/core"

await startDevServer({
  rootDirectoryUrl: new URL('../', import.meta.url),
+ nodeEsmResolution: false,
})
```

#### FileSystem magic resolution

The code below would throw 404 in a browser (assuming there is no "file" but "file.js")

```js
import "./file"
```

"file" must be resolved and transformed into:

```js
import "./file.js"
```

If not needed, magic file extension can be disabled.

```diff
import { startDevServer } from "@jsenv/core"

await startDevServer({
  rootDirectoryUrl: new URL('../', import.meta.url),
+ fileSystemMagicResolution: false,
})
```

> **Warning**
> File system magic resolution must be enabled if some dependencies are using import without extensions.
