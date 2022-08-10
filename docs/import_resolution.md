# Import resolution

Jsenv resolve url found in files like a browser would: `new URL(specifier, baseUrl)`.
Inside js modules, the url resolution is augmented with [Node ESM resolution algorithm](#node-esm-resolution-algorithm) and [FileSystem magic resolution](#filesystem-magic-resolution).

## Node ESM resolution algorithm

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

## FileSystem magic resolution

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
