# Table of contents

- [Presentation](#Presentation)
  - [File structure](#File-structure)
    - [Esmodule format](#esmodule-format)
    - [Systemjs format](#systemjs-format)
    - [Global format](#global-format)
    - [Commonjs format](#commonjs-format)
- [Concrete example](#concrete-example)
  - [1 - Setup basic project](#1---setup-basic-project)
  - [2 - Generate bundles](#2---generate-bundles)
- [generateEsModuleBundle](#generateEsModuleBundle)
- [generateSystemJsBundle](#generateSystemJsBundle)
- [generateGlobalBundle](#generateglobalbundle)
  - [globalName](#globalName)
- [generateCommonJsBundle](#generateCommonJsBundle)
- [generateCommonJsBundleForNode](#generateCommonJsBundleForNode)
  - [nodeMinimumVersion](#nodeMinimumVersion)
- [Bundling parameters](#bundling-parameters)
  - [bundleDirectoryRelativeUrl](#bundleDirectoryRelativeUrl)
  - [entryPointMap](#entryPointMap)
  - [bundleDefaultExtension](#bundleDefaultExtension)
  - [externalImportSpecifiers](#externalImportSpecifiers)
  - [minify](#minify)
- [Shared parameters](#Shared-parameters)
- [Balancing](#balancing)

# Presentation

A bundle is the concatenation of an entry file and its dependencies into one file.

They are used to save http requests if your production servers are not compatible with http2 multiplexing (or not configured for it).
They also provide a dedicated build time where you can perform changes or optimization production specific like minifying files.

Jsenv uses [rollup](https://github.com/rollup/rollup) to provide functions generating bundle of various formats.
These formats output different code for the same files as shown in the next part.

## File structure

index.js

```js
import value from "./dependency.js"

export default value
```

dependency.js

```js
export default 42
```

### Esmodule format

Things to know about esmodule format:

- Cannot use top level await because browsers and Node.js does not support top level await for now
- Cannot be used in old browsers or node < 13.7

Here is the generated bundle using esmodule format for the [file structure](#File-structure)

```js
var index = 42

export default index
//# sourceMappingURL=main.js.map
```

### Systemjs format

Things to know about bundle using systemjs format:

- needs [systemjs](https://github.com/systemjs/systemjs) to be used
- compatible with dynamic import
- compatible with top level await

Here is the generated bundle using systemjs format for the [file structure](#File-structure)

```js
System.register([], function (exports) {
  return {
    execute: function () {
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

### Global format

Things to know about bundle using global format:

- runs in a browser environment
- needs a global variable
- not compatible with dynamic import
- not compatible with top level await

Here is the generated bundle using global format for the [file structure](#File-structure)

```js
var __whatever__ = (function () {
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

### Commonjs format

Things to know about bundle using commonjs format:

- runs in a Node.js environment
- not compatible with top level await

Here is the generated bundle using commonjs format for the [file structure](#File-structure)

```js
module.exports = 42
//# sourceMappingURL=main.cjs.map
```

Commonjs bundle put files content into a file executable in Node.js writing exports on `module.exports`.<br />
— see [Modules documentation on node.js](https://nodejs.org/docs/latest-v12.x/api/modules.html)

This commonjs bundle can be used by require.

```js
const namespace = require("./dist/commonjs/main.cjs")

console.log(namespace)
```

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

This project contains 3 files that will generate bundle when executed. To generate a bundle you can execute the corresponding file with node.

```console
node ./generate-systemjs-bundle.js
```

Or you can use the preconfigured script from package.json.

```console
npm run generate-systemjs-bundle
```

# generateEsModuleBundle

`generateEsModuleBundle` is an async function generating an esmodule bundle for your project.

```js
import { generateEsModuleBundle } from "@jsenv/core"

generateEsModuleBundle({
  projectDirectoryUrl: new URL("./", import.meta.url),
})
```

— source code at [src/generateEsModuleBundle.js](../../src/generateEsModuleBundle.js).

# generateSystemJsBundle

`generateSystemJsBundle` is an async function generating a systemjs bundle for your project.

```js
import { generateSystemJsBundle } from "@jsenv/core"

generateSystemJsBundle({
  projectDirectoryUrl: new URL("./", import.meta.url),
})
```

— source code at [src/generateSystemJsBundle.js](../../src/generateSystemJsBundle.js).

# generateGlobalBundle

`generateGlobalBundle` is an async function generating a global bundle for your project.

```js
import { generateGlobalBundle } from "@jsenv/core"

generateGlobalBundle({
  projectDirectoryUrl: new URL("./", import.meta.url),
  globalName: "__whatever__",
})
```

— source code at [src/generateGlobalBundle.js](../../src/generateGlobalBundle.js).

## globalName

`globalName` parameter controls what global variable will contain your entry file exports. This is a **required** parameter. Passing `"__whatever__"` means generated bundle will write your exports under `window.__whatever__`.

# generateCommonJsBundle

`generateCommonJsBundle` is an async function generating a commonjs bundle for your project.

```js
import { generateCommonJsBundle } from "@jsenv/core"

generateCommonJsBundle({
  projectDirectoryUrl: new URL("./", import.meta.url),
})
```

— source code at [src/generateCommonJsBundle.js](../../src/generateCommonJsBundle.js).

# generateCommonJsBundleForNode

`generateCommonJsBundleForNode` is an async function generating a commonjs bundle for your project assuming it will run in your current node version.

```js
import { generateCommonJsBundleForNode } from "@jsenv/core"

generateCommonJsBundleForNode({
  projectDirectoryUrl: new URL("./", import.meta.url),
  nodeMinimumVersion: "8.0.0",
})
```

— source code at [src/generateCommonJsBundleForNode.js](../../src/generateCommonJsBundleForNode.js)

## nodeMinimumVersion

`nodeMinimumVersion` parameter is a string representing the minimum node version your bundle will work with. This parameter is optional with a default value corresponding to your current node version.

# Bundling parameters

This section present parameters available to every function generating a bundle.

## bundleDirectoryRelativeUrl

`bundleDirectoryRelativeUrl` parameter is a string leading to a directory where bundle files are written. This parameter is optional with a default value specific to each bundling function:

- Default for `generateEsModuleBundle`:

  ```js
  "./dist/esmodule/"
  ```

- Default for `generateSystemJsBundle`:

  ```js
  "./dist/systemjs/"
  ```

- Default for `generateCommonJsBundle` and `generateCommonJsBundleForNode`:

  ```js
  "./dist/commonjs/"
  ```

- Default for `generateGlobalBundle`:

  ```js
  "./dist/global/"
  ```

## entryPointMap

`entryPointMap` parameter is an object describing your project entry points. A dedicated bundle is generated for each entry. This parameter is optional with a default value assuming your have one entry point being `index.js`.

```json
{
  "main": "./index.js"
}
```

## bundleDefaultExtension

`bundleDefaultExtension` parameter is a string representing a file extension added to each chunk generated for `entryPointMap` key. This parameter is optional with a default value of `".js"`.

> You might want to pass `".mjs"` when you are bundling esmodule files that will be imported by Node.js.

## externalImportSpecifiers

`externalImportSpecifiers` parameter is an array of string repsenting import that will be ignored whle generating the bundle. This parameter is optional with a default value being an empty array. This parameter can be used to avoid bundling some dependencies.

To better understand this let's assume your source files contains the following import.

```js
import { answer } from "foo"

export const ask = () => answer
```

If `externalImportSpecifiers` contains `foo` the generated bundle will keep that import untouched and still try to load this file resulting in a bundle as below:

- For bundle using `esmodule` format:

  ```js
  import { answer } from "foo"

  export const ask = () => answer
  ```

- For bundle using `systemjs` format

  ```js
  System.register(["foo"], function (exports) {
    var answer
    return {
      setters: [
        function (module) {
          answer = module.answer
        },
      ],
      execute: function () {
        exports("ask", function ask() {
          return answer
        })
      },
    }
  })
  ```

- For bundle using `commonjs` format

  ```js
  const { answer } = require("foo")

  module.exports.ask = () => answer
  ```

- For bundle using `global` format:

  ```js
  ;(function (exports, foo) {
    var ask = function ask() {
      return foo.answer
    }

    exports.ask = ask
    return exports
  })({}, foo)
  ```

  It means bundle using `global` format expect `window.foo` or `global.foo` to exists. You can control the expected global variable name using `globals`.

  ```js
  import { generateGlobalBundle } from "@jsenv/core"

  generateGlobalBundle({
    externalImportSpecifiers: ["foo"],
    globals: {
      foo: "bar",
    },
  })
  ```

## minify

`minify` parameter is a boolean controlling if bundle content will be minified to save bytes. This parameter is optional with a default value of `false`.

# Shared parameters

To avoid duplication some parameter are linked to a generic documentation.

- [projectDirectoryUrl](../shared-parameters.md#projectDirectoryUrl)
- [jsenvDirectoryRelativeUrl](../shared-parameters.md#jsenvDirectoryRelativeUrl)
- [babelPluginMap](../shared-parameters.md#babelPluginMap)
- [convertMap](../shared-parameters.md#convertMap)
- [importMapFileRelativeUrl](../shared-parameters.md#importMapFileRelativeUrl)
- [importDefaultExtension](../shared-parameters.md#importDefaultExtension)
- [compileServerLogLevel](../shared-parameters.md#compileServerLogLevel)
- [compileServerProtocol](../shared-parameters.md#compileServerProtocol)
- [compileServerPrivateKey](../shared-parameters.md#compileServerPrivateKey)
- [compileServerCertificate](../shared-parameters.md#compileServerCertificate)
- [compileServerIp](../shared-parameters.md#compileServerIp)
- [compileServerPort](../shared-parameters.md#compileServerPort)

# Balancing

If you check source code you might see some code related to a balancing concept. It is not documented nor ready to be used. It's likely never going to have a use case.
