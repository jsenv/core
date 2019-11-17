## Table of contents

- [Presentation](#Presentation)
- [Systemjs format](#systemjs-format)
- [Global format](#global-format)
- [Commonjs format](#commonjs-format)
- [Code example](#code-example)
- [Concrete example](#concrete-example)
  - [1 - Setup basic project](#1---setup-basic-project)
  - [2 - Generate bundles](#2---generate-bundles)

## Presentation

A bundle is the concatenation of an entry file and its dependencies into one file.

They are used to save http requests if your production servers are not compatible with http2 multiplexing (or not configured for it).
They also provide a dedicated build time where you can perform changes or optimization production specific like minifying files.

Jsenv uses [rollup](https://github.com/rollup/rollup) to provide functions generating bundle of various formats.
Each format shines in different situations explained later in this document.
Each section shows what bundle would be generated for the following file structure:

### File structure

index.js

```js
import value from "./dependency.js"

export default value
```

dependency.js

```js
export default 42
```

## Systemjs format

Things to know about bundle using systemjs format:

- needs [systemjs](https://github.com/systemjs/systemjs) to be used
- compatible with dynamic import
- compatible with top level await

Systemjs bundle generated for the [file structure](#File-structure)

```js
System.register([], function(exports) {
  return {
    execute: function() {
      exports("default", 42)
    },
  }
})
//# sourceMappingURL=main.js.map
```

Systemjs bundle put files content into a System.register call. This format was invented by systemjs to polyfill module feature like top level await.<br />
— see [System.register documentation on github](https://github.com/systemjs/systemjs/blob/762f46db81b55e48891b42e7a97af374478e9cf7/docs/system-register.md)

This systemjs bundle can be used by loading systemjs library and importing the bundle file.

```html
<script src="https://unpkg.com/systemjs@6.1.4/dist/system.js"></script>
<script>
  window.System.import("./dist/systemjs/main.js").then((namespace) => {
    console.log(namespace.default)
  })
</script>
```

## Global format

Things to know about bundle using global format:

- runs in a browser environment
- needs a global variable
- not compatible with dynamic import
- not compatible with top level await

Global bundle generated for the [file structure](#File-structure)

```js
var __whatever__ = (function() {
  return 42
})()
//# sourceMappingURL=./main.js.map
```

Global bundle put files content into a function executable in old browsers writing exports on `window.__whatever__`.

This global bundle can be used with a classic script tag.

```html
<script src="./dist/global/main.js"></script>
<script>
  console.log(window.__whatever__)
</script>
```

## Commonjs format

Things to know about bundle using commonjs format:

- runs in a Node.js environment
- not compatible with top level await

commonjs bundle generated for the [file structure](#File-structure)

```js
module.exports = 42
//# sourceMappingURL=main.js.map
```

Commonjs bundle put files content into a file executable in Node.js writing exports on `module.exports`.<br />
— see [Modules documentation on node.js](https://nodejs.org/docs/latest-v12.x/api/modules.html)

This commonjs bundle can be used by require.

```js
const namespace = require("./dist/commonjs/main.js")

console.log(namespace)
```

### Code example

The following code uses `@jsenv/core` to create a systemjs bundle for `index.js` entry point.

```js
const { generateSystemJsBundle } = require("@jsenv/core")

generateSystemJsBundle({
  projectDirectoryPath: __dirname,
  bundleDirectoryRelativePath: "./dist",
  entryPointMap: {
    main: "./index.js",
  },
})
```

If you want to know more about this function and others check [api documentation](./api.md)

## Concrete example

This part explains how to quickly setup a real environment where you can generate different bundles.<br />
You can also reuse the project file structure to understand how to integrate jsenv to generate your bundles.

### 1 - Setup basic project

```console
git clone https://github.com/jsenv/jsenv-core.git
```

```console
cd ./jsenv-core/docs/bundling/basic-project
```

```console
npm install
```

### 2 - Generate bundles

This project contains 3 files that will generate bundle when executed.

To generate a bundle you can execute the corresponding file with node.

```console
node ./generate-systemjs-bundle.js
```

Or you can use the preconfigured script from package.json.

```console
npm run generate-systemjs-bundle
```
