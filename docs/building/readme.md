# Jsenv build

This is an in-depth documentation about jsenv build. For a quick overview go to [build overview](../../readme.md#build-overview).

This documentation list [key features](#key-features) and gives the [definition of a build for jsenv](#Definition-of-a-build-for-jsenv) to get an idea of how things where designed. Then it documents [buildProject](#buildProject) function, its parameters and return value. Finally you can find:

- [How to reference js assets?](#How-to-reference-js-assets)
- [Long term caching](#Long-term-caching)
- [SystemJS format](#SystemJS-format)
- [Frontend build](#Frontend-build)
- [Node package build](#Node-package-build)
- [Disable concatenation](#Disable-concatenation)

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

_buildDirectoryRelativeUrl_ is a string leading to a directory where files are written. This parameter is **required**.

## entryPointMap

_entryPointMap_ is an object describing the project files you want to read and their destination in the build directory. This parameter is **required**.

_entryPointMap_ keys are relative to project directory and values are relative to build directory.

## format

_format_ is a string indicating the module format of the files written in the build directory. This parameter is **required** and must be one of `"esmodule"`, `"systemjs"`, `"commonjs"`, `"global"`.

— see [SystemJS format](#SystemJS-format)

## minify

_minify_ is a boolean controlling if build files will be minified to save bytes. This parameter is optional and enabled by default when `process.env.NODE_ENV` is `"production"`.

When enabled: js, css, html, importmap, json, svg are minified.

```js
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  format: "esmodule",
  minify: true,
})
```

## externalImportSpecifiers

_externalImportSpecifiers_ is an array of string representing imports that will be ignored whle generating the build files. This parameter is optional with a default value being an empty array. This parameter can be used to avoid building some dependencies.

To better understand this let's assume your source files contains the following import.

```js
import { answer } from "foo"

export const ask = () => answer
```

If _externalImportSpecifiers_ contains `"foo"` the generated files will keep that import untouched. Depending on _format_ the generated code differs as shown below:

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

## urlVersioning

_urlVersioning_ is a boolean controlling the file written in the build directory will be versioned. This parameter is optional and enabled by default.

When enabled, the files written in the build directory have dynamic names computed from the source file content. This allows to enable [long term caching](#long-term-caching) of your files.

## assetManifestFile

_assetManifestFile_ is a boolean controlling if an _asset-manifest.json_ file will be written in the build directory. This parameter is optional and disabled by default.

When _urlVersioning_ is enabled, the files have dynamic names. Generating a manifest file can be important to be able to find the generated files.

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

## importResolutionMethod

_importResolutionMethod_ is a string controlling how import will be resolved. This parameter is optional, the default value is infered from [format](#format). When _format_ is `"commonjs"` default is `"node"`, otherwise it is `"importmap'`.

| Value | Description                                                                     |
| ---------------------- | ------------------------------------------------------------------------------- |
| `"importmap"`          | import are resolved by standard import resolution, the one used by web browsers |
| `"node"`               | imports are resolved by Node.js module resolution                               |

## Shared parameters

To avoid duplication some parameter are linked to a generic documentation.

- [projectDirectoryUrl](../shared-parameters.md#projectDirectoryUrl)
- [importDefaultExtension](../shared-parameters.md#importDefaultExtension)
- [babelPluginMap](../shared-parameters.md#babelPluginMap)
- [convertMap](../shared-parameters.md#convertMap)
- [compileServerLogLevel](../shared-parameters.md#compileServerLogLevel)
- [compileServerProtocol](../shared-parameters.md#compileServerProtocol)
- [compileServerPrivateKey](../shared-parameters.md#compileServerPrivateKey)
- [compileServerCertificate](../shared-parameters.md#compileServerCertificate)
- [compileServerIp](../shared-parameters.md#compileServerIp)
- [compileServerPort](../shared-parameters.md#compileServerPort)
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

## How to reference js assets?

The following pattern should be used to o reference an asset from a js file:

```js
const imageUrl = new URL("./img.png", import.meta.url)
```

This pattern is recognized by jsenv build which detects the dependency to `"./img.png"`.

The following pattern is also supported but should be avoided as it's not standard.

```js
import imageUrl from "./img.png"
```

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
+   <script src="assets/s.min-550cb99a.js"></script>
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

`<script src="assets/s.min-550cb99a.js"></script>` was injected into `<head>`: this is SystemJS script. SystemJS is injected only if the html source file contains a `<script type="module"></script>`, otherwise systemjs is not needed so it's not injected.

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

## Embed frontend

Embed refers to a product that is meant to be injected into website you don't own, like a video embed for instance. In that case, developper using your product can inject it in their web page using an iframe.

```html
<iframe src="./dist/main.html"></iframe>
```

## Progressive Web Application (PWA)

There is a pre configured GitHub repository template for this use case: [jsenv-template-pwa](https://github.com/jsenv/jsenv-template-pwa#progressive-web-application-template).

If you want to build a PWA, you have a service worker file referenced somewhere by _navigator.serviceWorker.register_.

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf8" />
    <link rel="icon" href="data:," />
  </head>
  <body>
    <script type="module">
      navigator.serviceWorker.register("/sw.js")
    </script>
  </body>
</html>
```

For this scenario, you must manually specify the usage of `"/sw.js"` to jsenv using _serviceWorkers_ parameter.

```js
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  serviceWorkers: {
    "./sw.js": "./sw.js",
  },
})
```

For each service worker file specified in _serviceWorkers_ a corresponding file will be written to the build directory. So if you forget to pass `"sw.js"` using _serviceWorkers_ parameter, `"sw.js"` won't be in the build directory.

A service worker file is special:

- you can use _self.importScripts_
- you cannot use _import_ keyword
- ...many more differences...

Jsenv won't try to change this.
So you must write the service worker file in a way that browser can understand.
During build, the following steps are taken for every service worker file specified in _serviceWorkers_:

1. Inline every _self.importScripts_
2. Minify the resulting service worker file
3. Write the final service worker file into the build directory

### Jsenv service worker

When generating the build jsenv knows every file used by your frontend files. This information can be injected into a service worker to preload or put into cache all these urls. This can be done with _serviceWorkerFinalizer_ as shown in the code below:

```diff
- import { buildProject } from "@jsenv/core"
+ import { buildProject, jsenvServiceWorkerFinalizer } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  serviceWorkers: {
    "./sw.js": "./sw.js",
  },
+ serviceWorkerFinalizer: jsenvServiceWorkerFinalizer,
})
```

_serviceWorkerFinalizer_ injects a variable into the service worker file called `self.generatedUrlsConfig`. At this stage you can write your own service worker to do something with this variable. You can also use a service worker already written to handle this: https://github.com/jsenv/jsenv-pwa/blob/master/docs/jsenv-service-worker.md.

# Node package build

A node package does not have the same constraints than the web. If you are targeting recent Node.js versions you can skip the build step completely and serve your files untouched. See the jsenv GitHub repository template to start a node package from sratch: [jsenv-template-node-package](https://github.com/jsenv/jsenv-template-node-package).

# Disable concatenation

By default js files are concatenated as much as possible. There is legitimates reasons to disable this behaviour. Merging `n` files into chunks poses two issues:

- On a big project it becomes very hard to know what ends up where.
  Tools like [webpack bundle analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer) exists to mitigate this but it's still hard to grasp what is going on.
- When a file part of a chunk is modified the entire chunk must be recreated. A returning user have to redownload/parse/execute the entire chunk even if you modified only one line in one file.

Disabling concatenation will fixe these two issues, but also means browser will have to create an http request per file. Thanks to http2, one connection can be reused to serve `n` files meaning concatenation becomes less crucial.

> It's still faster for a web browser to donwload/parse/execute one big file than doing the same for 50 tiny files.

I would consider the following before disabling concatenation:

- Is production server compatible with http2?
- Is there a friendly loading experience on the website? (A loading screen + a progress bar for instance)
- What type of user experience I want to favor: new users or returning users?

Concatenation cannot be disabled because rollup cannot do that. It should be possible with rollup 3.0 as stated in https://github.com/rollup/rollup/issues/3882. Whenever rollup makes it possible it will become possible to use `jsConcatenation` parameter to disable concatenation.

```js
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  format: "esmodule",
  jsConcatenation: false,
})
```

```

```
