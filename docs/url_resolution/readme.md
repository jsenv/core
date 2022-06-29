# Url resolution

This documentation explains how jsenv behaves regarding urls declared in your files.

- Short explanation: Like a browser would + a bit more for js modules
- Long explanation: Rest of this document

## Full path specifier

When you would have to use `"../"` it's recommended to rather use the explicit url specifier starting with `/`.

```diff
-  background-image: url(../../logo.png);
+  background-image: url(/src/logo.png);
```

- :+1: create consistent specifiers
- :+1: escape `"../../"` hell.

## Url resolution outside js modules

Outside js modules all urls are resolved by the standard url resolution: `new URL(specifier, baseUrl)`.

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

Inside js modules url resolution is augmented with "Node ESM resolution algorithm" and "FileSystem magic resolution" explained below

#### Node ESM resolution algorithm

The code below would throw in a browser

```js
import "amazing-package"
```

It must be resolved and transformed into

```js
import "/node_modules/amazing-package/index.js"
```

The entire Node ESM resolution applies meaning you can use the following:

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

It must be resolved and transformed into

```js
import "./file.js"
```

If you don't need magic file extension you can disable it.

```diff
import { startDevServer } from "@jsenv/core"

await startDevServer({
  rootDirectoryUrl: new URL('../', import.meta.url),
+ fileSystemMagicResolution: false,
})
```

> **Warning**
> You must keep file system magic resolution if some of your dependencies are using import without extensions.
