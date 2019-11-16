## Table of contents

- [Presentation](#Presentation)
- [Global format](#global-format)
- [Systemjs format](#systemjs-format)
- [Commonjs format](#commonjs-format)
- [Code example](#code-example)
- [Concrete example](#concrete-example)
  - [1 - Setup basic project](#1---setup-basic-project)
  - [2 - Generate bundles](#2---generate-bundles)

## Presentation

A bundle is the concatenation of many files into one.

They are used to save http requests if your production servers are not compatible with http2 multiplexing (or not configured for it).
They also provide a dedicated build time where you can perform changes or optimization production specific like minifying files.

Jsenv uses [rollup](https://github.com/rollup/rollup) to provide functions generating bundle of various formats. Each format shines in different situations explained later in this document.

## Global format

Things to know about bundle using global format:

- runs in a browser environment
- needs collision free global variable
- not compatible with dynamic import
- not compatible with top level await

For example [./basic-project/index.js](./basic-project/index.js) is bundled to [./basic-project/dist/global/main.js](./basic-project/dist/global/main.js).

That global bundle could be used by

```html
<script src="./dist/global/main.js"></script>
<script>
  console.log(window.__whatever__)
</script>
```

## Systemjs format

Things to know about bundle using systemjs format:

- needs [systemjs](https://github.com/systemjs/systemjs) to be used
- compatible with dynamic import
- compatible with top level await

For example [./basic-project/index.js](./basic-project/index.js) is bundled to [./basic-project/dist/systemjs/main.js](./basic-project/dist/systemjs/main.js).

That systemjs bundle could be used by

```html
<script src="https://unpkg.com/systemjs@6.1.4/dist/system.js"></script>
<script>
  window.System.import("./dist/systemjs/main.js").then((namespace) => {
    console.log(namespace.default)
  })
</script>
```

## Commonjs format

Things to know about bundle using commonjs format:

- runs in a Node.js environment
- not compatible with top level await

For example [./basic-project/index.js](./basic-project/index.js) is bundled to [./basic-project/dist/commonjs/main.js](./basic-project/dist/commonjs/main.js).

That commonjs bundle could be used by

```js
const exports = require("./dist/commonjs/main.js")

console.log(exports)
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

This part explains how to quickly setup a real environment where you can generate different bundles.

### 1 - Setup basic project

```console
git clone git@github.com:jsenv/jsenv-core.git
```

```console
cd ./jsenv-core/docs/bundling/basic-project
```

```console
npm install
```

### 2 - Generate bundles

This project has preconfigured 3 files that will generate bundles.

[./basic-project/generate-systemjs-bundle.js](./basic-project/generate-systemjs-bundle.js) generates [./basic-project/dist/systemjs/main.js](./basic-project/dist/systemjs/main.js) file.

[./basic-project/generate-global-bundle.js](./basic-project/generate-global-bundle.js) generates [./basic-project/dist/global/main.js](./basic-project/dist/global/main.js) file.

[./basic-project/generate-commonjs-bundle.js](./basic-project/generate-commonjs-bundle.js) generates [./basic-project/dist/commonjs/main.js](./basic-project/dist/commonjs/main.js) file.
