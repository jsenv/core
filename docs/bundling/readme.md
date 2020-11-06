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
- [Html entry point](#html-entry-point)
- [Bundling parameters](#bundling-parameters)
  - [bundleDirectoryRelativeUrl](#bundleDirectoryRelativeUrl)
  - [entryPointMap](#entryPointMap)
  - [externalImportSpecifiers](#externalImportSpecifiers)
  - [minify](#minify)
- [Shared parameters](#Shared-parameters)

# Presentation

A bundle consist into taking one or many input files to generate one or many output files. It provides a dedicated build time where you can perform production specific optimizations:

- File concatenation to save http request
- Minification or compression to reduce file size
- Hash url to enable long term caching

A basic example applied to an html file

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="./img.png" />
  </head>
  <body></body>
</html>
```

Becomes

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="assets/img-25e95a00.png" />
  </head>
  <body></body>
</html>
```

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

Use `esmodule` format if you want a bundle that can be consumed like this:

```html
<script type="module">
  import value from "./dist/main.js"
</script>
```

Things to know about esmodule format:

- Cannot use top level await because browsers and Node.js does not support top level await for now
- Cannot use importmaps because not yet supported
- Cannot be used in old browsers or node < 13.7

Here is the generated bundle using esmodule format for the [file structure](#File-structure)

```js
var index = 42

export default index
//# sourceMappingURL=main.js.map
```

### Systemjs format

Use `systemjs` format if you any of the feature listed below. Assuming that feature is not supported in the browsers that you want to be compatible with.

##### import export keywords

```js
import foo from "./foo.js"
```

##### dynamic import

```js
const namespace = await import("./foo.js")
```

##### top level await

```js
const a = await Promise.resolve(42)
```

##### import remapping using importmap

```js
import foo from "foo"
```

— see [importmap specifications](https://github.com/WICG/import-maps)

systemjs bundle can be used by loading systemjs library and importing the bundle file as shown below.

```html
<script src="https://unpkg.com/systemjs@6.1.4/dist/system.js"></script>
<script>
  window.System.import("./dist/systemjs/main.js").then((namespace) => {
    console.log(namespace.default)
  })
</script>
```

If you use an [html entry point](#Html-entry-point) this is done for you automatically

Things to know about bundle using systemjs format:

- needs [systemjs](https://github.com/systemjs/systemjs) to be used
- compatible with dynamic import
- compatible with top level await
- compatible with importmap

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

### Global format

Use `global` format if you want a bundle that can be consumed by a browser like this:

```html
<script src="./dist/global/main.js"></script>
<script>
  console.log(window.__whatever__)
</script>
```

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

### Commonjs format

Use `commonjs` format to generate a file that can be used in Node.js like this:

```js
const namespace = require("./dist/commonjs/main.cjs")

console.log(namespace)
```

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

# Html entry point

When generating a bundle, if you provide an html file in [entryPointMap](#entryPointMap), cool things happens...

Let's get an overview with the following `index.html` file

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="./favicon.ico" />
    <script type="importmap" src="./project.importmap"></script>
    <link rel="stylesheet" type="text/css" href="./main.css" />
  </head>

  <body>
    <script type="module" src="./main.js"></script>
  </body>
</html>
```

To keep the example short let's assume the following file exists: `favicon.ico`, `project.importmap`, `main.css` and `index.js`.

Now let's generate a bundle passing `index.html` as entry point.

```js
import { generateBundle } from "@jsenv/core"

await generateBundle({
  format: "systemjs",
  enryPointMap: {
    "./index.html": "main.html",
  },
})
```

Here is the html generated in `dist/systemjs/main.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="assets/favicon-5340s4789a.ico" />
    <script src="assets/s.min-550cb99a.js"></script>
    <script type="systemjs-importmap" src="import-map-b237a334.importmap"></script>
    <link rel="stylesheet" type="text/css" href="assets/main-3b329ff0.css" />
  </head>

  <body>
    <script type="systemjs-module" src="./main-f7379e10.js"></script>
  </body>
</html>
```

The following happened:

##### url hashing

All urls now contains a hash, allowing long term caching of your assets.

An article to explain long term caching: https://jakearchibald.com/2016/caching-best-practices/#pattern-1-immutable-content--long-max-age

Please note url are replaced in the html, css, js, or svg files referencing an url. This is done using js parser (rollup), a css parser (postcss) or an html/svg parser (parse-5). This is recursive meaning it works for css imported by css or svg importing an image and so on.

Consequently, if `main.css` content is the following:

```css
body {
  background: url("./favicon.ico");
}
```

`dist/systemjs/assets/main-3b329ff0.css` content is the following:

```css
body {
  background: url("favicon-5340s4789a.ico");
}
```

##### module script polyfill

As you can see

```html
<script type="module" src="./main.js"></script>
```

Was transformed into

```html
<script type="systemjs-module" src="./main-f7379e10.js"></script>
```

> Happens only when using `systemjs` format. If you use `esmodule` format your `<script type="module"></script>` are kept untouched.

This is to make your html file compatible with browser that does not support `<script type="module"></script>` or because you want to use an other feature not yet supported like top level await or import maps. To provide `window.System` the following script tag was injected into `<head>` of `dist/systemjs/main.html`

```html
<script src="assets/s.min-550cb99a.js"></script>
```

It loads systemjs that creates `window.System` that is needed to import the js file.

> If you have no `<script type="module"></script>` in the html file, this script is not needed so it's no injected in `<head>`

# Bundling parameters

This section present parameters available to every function generating a bundle.

## bundleDirectoryRelativeUrl

`bundleDirectoryRelativeUrl` parameter is a string leading to a directory where bundle files are written. This parameter is optional with a default value specific to each bundling function:

- Default for `esmodule` format:

  ```js
  "./dist/esmodule/"

  ```

- Default for `systemjs` format:

  ```js
  "./dist/systemjs/"

  ```

- Default for `commonjs` format:

  ```js
  "./dist/commonjs/"

  ```

- Default for `global` fromat:

  ```js
  "./dist/global/"

  ```

## entryPointMap

`entryPointMap` parameter is an object describing your project entry points. A dedicated bundle is generated for each entry. This parameter is optional with a default value assuming you have one entry point being `index.js` that will be written into `dist/${format}/main.js`.

```json
{
  "./index.js": "./main.js"
}
```

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
