# Jsenv build

This is an in-depth documentation about jsenv build. For a quick overview go to [build overview](../../readme.md#build-overview).

This documentation list [key features](#key-features) and gives the [definition of a build for jsenv](#Definition-of-a-build-for-jsenv) to get an idea of how things where designed. Then it documents [buildProject](#buildProject) function, its parameters and return value. Finally you can find:

- [How to reference assets?](#How-to-reference-assets)
- [Long term caching](#Long-term-caching)
- [SystemJS format](#SystemJS-format)
- [Frontend build](#Frontend-build)
- [Node package build](#Node-package-build)

# Key features

- Url versioning to enable long term caching
- Accurate cache invalidation: changing one file invalidates one file in browser cache
- Can build code that works on browsers without native support for:
  - importmap
  - top level await
  - script type module
  - anything babel can transform
- Can minify html, css, js, json, svg.
- Generate sourcemap files for js and css
- Can build service worker files
- Regroup js files into chunks (concatenation)

# Definition of a build for jsenv

A build consists into taking one or many input files to generate one or many output files. It creates a step between dev and production where you can perform specific optimizations:

- File concatenation to save http request
- Minify file content to reduce file size
- Inject hash based on file content into urls to enable long term caching
- Transform file content to support more execution environments (old browsers for instance)

# buildProject

_buildProject_ is an async function reading project files, transforming them and writing the resulting files in a directory.

```js
import { buildProject } from "@jsenv/core"

const { buildMappings, buildManifest } = await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryRelativeUrl: "./dist/",
  entryPointMap: {
    "./main.html": "./main.min.html",
  },
  format: "esmodule",
  minify: true,
})
```

## buildDirectoryRelativeUrl

_buildDirectoryRelativeUrl_ is a string leading to a directory where files are written.

_buildDirectoryRelativeUrl_ is **required**.

## entryPointMap

_entryPointMap_ is an object describing the project files you want to read and their destination in the build directory.

_entryPointMap_ is **required**.

_entryPointMap_ keys are relative to project directory and values are relative to build directory.

## format

_format_ is a string indicating the module format of the files written in the build directory.

_format_ is **required**. It must be `"esmodule"`, `"systemjs"`, `"commonjs"` or `"global"`.

— see [SystemJS format](#SystemJS-format)

## importResolutionMethod

_importResolutionMethod_ is a string controlling how import will be resolved.

_importResolutionMethod_ is optional. The default is `"importmap"` or `"node"` when [format](#format) is `"commonjs"`.

| Value         | Description                                                                     |
| ------------- | ------------------------------------------------------------------------------- |
| `"importmap"` | import are resolved by standard import resolution, the one used by web browsers |
| `"node"`      | imports are resolved by Node.js module resolution                               |

## externalImportSpecifiers

_externalImportSpecifiers_ is an array of string representing imports that will be ignored whle generating the build files. This parameter can be used to avoid building some dependencies.

_externalImportSpecifiers_ is optional.

For example, you have a file with the following import:

```js
import { value } from "foo"

export const getValue = () => value
```

And you mark `"foo"` as external using _externalImportSpecifiers_:

```js
await buildProject({
  externalImportSpecifiers: ["foo"],
})
```

The code generated during the build depends on _format_ as shown below:

<table>
  <thead>
    <tr>
      <th>Format
      </th>
      <th>Code generated
      </th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>esmodule</td>
      <td>

```js
import { answer } from "foo"

export const ask = () => answer
```

</td>
    </tr>
    <tr>
      <td>systemjs</td>
      <td>

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

</td>
    </tr>
    <tr>
      <td>commonjs</td>
      <td>

```js
const { answer } = require("foo")

module.exports.ask = () => answer
```

</td>
    </tr>
    <tr>
      <td>global</td>
      <td>

```js
;(function (exports, foo) {
  var ask = function ask() {
    return foo.answer
  }

  exports.ask = ask
  return exports
})({}, foo)
```

</td>
    </tr>
  </tbody>
</table>

Code generated for `"global"` format expect `window.foo` or `global.foo` to exists. You can control the expected global variable name using _globals_.

```js
import { buildProject } from "@jsenv/core"

buildProject({
  format: "global",
  externalImportSpecifiers: ["foo"],
  globals: {
    foo: "bar",
  },
})
```

## workers

_workers_ is an object used to declare files written for [web workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers).

_workers_ is optional.

If your source file references a worker file as below:

```js
const workerUrl = new URL("/worker.js", import.meta.url)

const worker = new Worker(workerUrl)
```

Then you should tell jsenv this is a worker using _workers_ parameter.

```diff
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryRelativeUrl: "./dist/",
  format: "systemjs",
  workers: {
+   "./worker.js": "./worker.js",
  }
})
```

Thanks to this, jsenv knows it's a worker file and will detect usage of [importScripts](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers#importing_scripts_and_libraries).

## urlVersioning

_urlVersioning_ is a boolean controlling the file written in the build directory will be versioned. When enabled, the files written in the build directory have dynamic names computed from the source file content. This allows to enable [long term caching](#long-term-caching) of your files.

_urlVersioning_ is optional. It is enabled by default.

## assetManifestFile

_assetManifestFile_ is a boolean controlling if an _asset-manifest.json_ file will be written in the build directory. When _urlVersioning_ is enabled, the files have dynamic names. Generating a manifest file can be important to be able to find the generated files.

_assetManifestFile_ is optional.

Example of an _asset-manifest.json_ file content:

```json
{
  "assets/home.css": "assets/home-2e7e167b.css",
  "assets/metal.jpg": "assets/metal-36435573.jpg",
  "importmap.prod.importmap": "importmap.prod-3837ea79.importmap",
  "main.js": "main-8de756b8.js",
  "main.html": "main.html"
}
```

## minify

_minify_ is a boolean controlling if build files will be minified to save bytes. When enabled js, css, html, importmap, json and svg files are minified.

_minify_ is optional.

```js
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  format: "esmodule",
  minify: true,
})
```

## Shared parameters

To avoid duplication some parameter are linked to a generic documentation.

- [projectDirectoryUrl](../shared-parameters.md#projectDirectoryUrl)
- [importDefaultExtension](../shared-parameters.md#importDefaultExtension)
- [babelPluginMap](../shared-parameters.md#babelPluginMap)
- [customCompilers](../shared-parameters.md#customCompilers)
- [logLevel](../shared-parameters.md#logLevel)
- [protocol](../shared-parameters.md#protocol)
- [privateKey](../shared-parameters.md#privateKey)
- [certificate](../shared-parameters.md#certificate)
- [ip](../shared-parameters.md#ip)
- [port](../shared-parameters.md#port)
- [jsenvDirectoryRelativeUrl](../shared-parameters.md#jsenvDirectoryRelativeUrl)

## buildProject return value

_buildProject_ return a value with the following shape

```js
{
  buildManifest,
  buildMappings,
}
```

### buildManifest

_buildManifest_ is part of _buildProject_ return value. This object will contain a key/value pair for each file written in the build directory.

Keys and values are strings, both represent are file path relative to the build directory. But keys are paths without url versioning while values are paths with url versionning.

_Example of a buildManifest value:_

```js
{
  "main.html": "main.html",
  "assets/main.css": "assets/main-2e7e167b.css",
  "main.js": "main-8de756b8.js"
}
```

The value above can be translated into the following sentence where build directory is assumed to be `dist`.

> "Three files where written in `dist/`: `main.html`, `assets/main.css` and `main.js`. <br /> `main.html` was not versioned but `assets/main.css` and `main.js` are versioned."

### buildMappings

_buildMappings_ is part of _buildProject_ return value. This object will contain a key/value pair for each file written in the build directory.

Keys and values are strings, both are file path, keys are relative to project directory while values are relative to the build directory.

_Example of a buildMappings value:_

```js
{
  "main.html": "main.html",
  "src/main.css": "assets/main-2e7e167b.css",
  "src/main.js": "main-a340d0ae.js"
}
```

The value above can be translated into the following sentence where build directory is assumed to be _dist_:

"Three files where written in _dist/_ from project directory:
_main.html_ can be found at _dist/main.html_, _src/main.css_ at _dist/assets/main-2e7e167b.css_ and _src/main.js_ at _dist/main-a340d0ae.js_"

## How to reference assets?

### import assertions

For JSON and CSS import assertions are recommended.

```js
import json from "./data.json" assert { type: "json" }

console.log(json)
```

```js
import sheet from "./style.css" assert { type: "css" }

document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
```

Dynamic import assertion are also supported

```js
const jsonModule = await import("./data.json", {
  assert: { type: "json" },
})
console.log(jsonModule.default)
```

### import meta url pattern

For the remaining ressources `new URL() + import meta url` pattern is recommended.

```js
const imageUrl = new URL("./img.png", import.meta.url)

const img = document.createElement("img")
img.src = imageUrl
document.body.appendChild(img)
```

```js
const workerUrl = new URL("/worker.js", import.meta.url)

const worker = new Worker(workerUrl)
```

> Worker must be referenced with the absolute path: starting with "/"

### With customCompilers

You can import non-js ressources using static import as shown below

```js
import text from "./data.txt"

console.log(text)
```

However this cannot run directly in the browser. It needs to be transformed into something standard.
This can be achieved by associating `"**/*.txt"` with `textToJavaScriptModule` in [customCompilers](https://github.com/jsenv/jsenv-core/blob/master/docs/shared-parameters.md#customcompilers).

```js
import { textToJavaScriptModule } from "@jsenv/core"

export const customCompilers = {
  // Dynamically convert text files to javascript modules
  "**/*.txt": textToJavaScriptModule,
}
```

Keep in mind jsenv tries to use source files when possible. Using `customCompilers` indicates some of your code needs to be compiled, forcing jsenv to compile files before executing them.

# Long term caching

Long term caching consists into configuring a web server to send a `cache-control` header when serving your files. When doing so, browser caches the file for the duration configured by the server. As long as it is valid, browser will not even ask server if the file changed.

The screenshot belows shows how a 144kB file takes 1ms for the browser to fetch in that scenario.

![screenshot showing request with long term cahcing](./long-term-caching-from-cache.png)

> An article to explain long term caching: https://jakearchibald.com/2016/caching-best-practices/#pattern-1-immutable-content--long-max-age

This is a massive boost in performance but can be tricky to setup because you need to know how and when to invalidate browser cache. Jsenv is versioning urls based on their content during build. Thanks to this you can enable long term caching of your files.

For instance, if you write this in an html file:

```html
<link rel="icon" href="./favicon.ico" />
```

After the build, it becomes:

```html
<link rel="icon" href="assets/favicon-5340s4789a.ico" />
```

Jsenv does this for every url found in html, js, css and svg files. It uses parse5 to parse html, Babel to parse JavaScript and PostCSS to parse css. For instance, if `main.css` content is the following:

```css
body {
  background: url("./favicon.ico");
}
```

`dist/assets/main-3b329ff0.css` content is the following:

```css
body {
  background: url("favicon-5340s4789a.ico");
}
```

You can disable url versioning if you don't want it using [urlVersioning](#urlVersioning) parameter as shown below:

```js
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  format: "esmodule",
  urlVersioning: false,
})
```

## How importmap improves cache reuse

Import maps is a standard that is starting to be supported by Web browsers. It is the future proof way of controlling how js imports are resolved.

Thanks to importmap it's possible to reuse files from cache and only remap their references to the file that was updated. It drastically improve cache reuse of files generated with [urlVersioning](#urlVersioning) enabled.

| Action        | Context           | Cache impact               |
| ------------- | ----------------- | -------------------------- |
| Update 1 file | without importmap | **n urls**\* to redownload |
| Update 1 file | with importmap    | **1 url** to redownload    |

\*n is the number of other files referencing the updated file directly or indirectly

— Link to import maps specifications on GitHub: https://github.com/WICG/import-maps

## SystemJS format

Amongst other things, jsenv uses top level await and import maps. But for now the native browser support of these features is too small. For this reason you likely want to build your files into the _systemjs_ format.

To use SystemJS format, use [format](#format) parameter

```js
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryRelativeUrl: "dist",
  format: "systemjs",
  enryPointMap: {
    "./index.html": "main.html",
  },
  minify: false,
})
```

When using the _systemjs_ format the generated html is a bit different:

```diff
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="assets/favicon-5340s4789a.ico" />
+   <script src="assets/s.min-550cb99a.js" id="jsenv_inject_systemjs"></script>
-   <script type="importmap" src="import-map-b237a334.importmap"></script>
+   <script type="systemjs-importmap" src="import-map-b237a334.importmap"></script>
    <link rel="stylesheet" type="text/css" href="assets/main-3b329ff0.css" />
  </head>

  <body>
-   <script type="module" src="./main-f7379e10.js"></script>
+   <script type="systemjs-module" src="./main-f7379e10.js"></script>
  </body>
</html>
```

`<script src="assets/s.min-550cb99a.js" id="jsenv_inject_systemjs"></script>` was injected into `<head>`: this is SystemJS script. SystemJS is injected only if the html source file contains a `<script type="module"></script>`, otherwise systemjs is not needed so it's not injected.

`<script type="module">` are transformed into `<script type="systemjs-module">`. This is because systemjs will now load and execute these scripts. Amongst other things, it makes browser capable to execute code which had top level await or relies on importmap.

`<script type="importmap">` are transformed into `<script type="systemjs-importmap">`. Again this is because SystemJS is now handling the importmap.

— Link to SystemJS on GitHub: https://github.com/systemjs

# Frontend build

A frontend is composed of files that will be executed by a browser (Chrome, Firefox, ...). In other words you need to generate an html file and the files needed by this html file.

To do that provide your main html to jsenv. It will collect all the files used directly or indirectly by the html file. Once all the files are known they are eventually minified, concatenated and file urls are replaced with a unique url identifier to enable long term caching.

```js
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryRelativeUrl: "./dist/",
  entryPointMap: {
    "./main.html": "./main.html",
  },
  format: "systemjs",
})
```

There is a pre configured GitHub repository template for this use case: [jsenv-template-pwa](https://github.com/jsenv/jsenv-template-pwa#progressive-web-application-template). You can use the template both to create a regular website or a progressive web application.

# Node package build

A node package does not have the same constraints than the web. If you are targeting recent Node.js versions you can skip the build step completely and serve your files untouched. See the jsenv GitHub repository template to start a node package from sratch: [jsenv-template-node-package](https://github.com/jsenv/jsenv-template-node-package).
