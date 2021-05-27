# Table of contents

- [Presentation](#Presentation)
- [buildProject](#buildProject)
- [Building a frontend](#Building-a-frontend)
- [Building a Node.js package](#Building-a-nodejs-package)
- [Long term caching](#Long-term-caching)
- [SystemJS format](#Systemjs-format)
- [Disable concatenation](#Disable-concatenation)

# Presentation

Building consists into taking one or many input files to generate one or many output files. It creates a step between dev and production where you can perform specific optimizations:

- File concatenation to save http request
- Minify file content to reduce file size
- Hash url to enable long term caching
- Transform file content to support more execution environments (old browsers for instance)

# buildProject

`buildProject` is an async function reading project files, transforming them and writing the resulting files in a directory.

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

## buildProject parameters

`buildProject` uses named parameters documented below.

<details>
  <summary>buildDirectoryRelativeUrl</summary>

`buildDirectoryRelativeUrl` parameter is a string leading to a directory where files are written. This parameter is **required**.

</details>

<details>
  <summary>entryPointMap</summary>

`entryPointMap` parameter is an object describing the project files you want to read and their destination in the build directory. This parameter is **required**.

`entryPointMap` keys are relative to project directory and values are relative to build directory.

</details>

<details>
  <summary>format</summary>

`format` parameter is a string indicating the module format of the files written in the build directory. This parameter is **required** and must be one of `"esmodule"`, `"systemjs"`, `"commonjs"`, `"global"`.

</details>

<details>
  <summary>minify</summary>

`minify` parameter is a boolean controlling if build files will be minified to save bytes. This parameter is optional and enabled by default when `process.env.NODE_ENV` is `"production"`.

When enabled: js, css, html, importmap, json, svg are minified.

```js
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  format: "esmodule",
  minify: true,
})
```

</details>

<details>
  <summary>externalImportSpecifiers</summary>

`externalImportSpecifiers` parameter is an array of string repsenting imports that will be ignored whle generating the build files. This parameter is optional with a default value being an empty array. This parameter can be used to avoid building some dependencies.

To better understand this let's assume your source files contains the following import.

```js
import { answer } from "foo"

export const ask = () => answer
```

If `externalImportSpecifiers` contains `foo` the generated files will keep that import untouched and still try to load this file resulting in a file as below:

- For build using `esmodule` format:

  ```js
  import { answer } from "foo"

  export const ask = () => answer
  ```

- For build using `systemjs` format

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

- For build using `commonjs` format

  ```js
  const { answer } = require("foo")

  module.exports.ask = () => answer
  ```

- For build using `global` format:

  ```js
  ;(function (exports, foo) {
    var ask = function ask() {
      return foo.answer
    }

    exports.ask = ask
    return exports
  })({}, foo)
  ```

  It means build using `global` format expect `window.foo` or `global.foo` to exists. You can control the expected global variable name using `globals`.

  ```js
  import { buildProject } from "@jsenv/core"

  buildProject({
    externalImportSpecifiers: ["foo"],
    globals: {
      foo: "bar",
    },
  })
  ```

</details>

<details>
  <summary>urlVersioning</summary>

`urlVersioning` parameter is a boolean controlling the file written in the build directory will be versioned. This parameter is optional and enabled by default.

When enabled, the files written in the build directory have dynamic names computed from the source file content. This allows to enable [long term caching](#long-term-caching) of your files.

</details>

<details>
  <summary>assetManifestFile</summary>

`urlVersioning` parameter is a boolean controlling if an `asset-manifest.json` file will be written in the build directory. This parameter is optional and disabled by default.

When `urlVersioning` is enabled, the files have dynamic names. Generating a manifest file can be important to be able to find the generated files.

Example of an `asset-manifest.json` file content:

```json
{
  "assets/home.css": "assets/home-2e7e167b.css",
  "assets/metal.jpg": "assets/metal-36435573.jpg",
  "importmap.prod.importmap": "importmap.prod-3837ea79.importmap",
  "main.js": "main-8de756b8.js",
  "main.html": "main.html"
}
```

</details>

<details>
  <summary>importResolutionMethod</summary>

`importResolutionMethod` parameter is a string controlling how import will be resolved. This parameter is optional, the default value is infered from `format` parameter. When `format` is `"commonjs"` default resolution method is `"node"`, otherwise it is `"importmap'`.

`"importmap"` means import are resolved by standard import resolution, the one used by web browsers.

`"node"` means imports are resolved by Node.js module resolution.

If you need, you can force node module resolution by passing `importResolutionMethod: "node"`.

</details>

<details>
  <summary>Shared parameters</summary>

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

</details>

## buildProject return value

`buildProject` return a value with the following shape

```js
{
  buildManifest,
  buildMappings,
}
```

<details>
  <summary>buildManifest</summary>

`buildManifest` is part of buildProject return value. This object will contain a key/value pair for each file written in the build directory.

Keys and values are strings, both represent are file path relative to the build directory. But keys are paths without url versioning while values are paths with url versionning.

Example of a `buildManifest` value.

```js
{
  "main.html": "main.html",
  "assets/main.css": "assets/main-2e7e167b.css",
  "main.js": "main-8de756b8.js"
}
```

The value above can be translated into the following sentence where build directory is assumed to be `dist`.

> "Three files where written in `dist/`: `main.html`, `assets/main.css` and `main.js`. <br /> `main.html` was not versioned but `assets/main.css` and `main.js` are versioned."

</details>

<details>
  <summary>buildMappings</summary>

`buildMappings` is part of buildProject return value. This object will contain a key/value pair for each file written in the build directory.

Keys and values are strings, both are file path, keys are relative to project directory while values are relative to the build directory.

Example of a `buildMappings` value.

```js
{
  "main.html": "main.html",
  "src/main.css": "assets/main-2e7e167b.css",
  "src/main.js": "main-a340d0ae.js"
}
```

The value above can be translated into the following sentence where build directory is assumed to be `dist`.

> "Three files where written in `dist/` from project directory: `main.html`, `src/main.css` and `src/main.js`. <br /> `main.html` can be found at `dist/main.html`, `src/main.css` at `dist/assets/main-2e7e167b.css` and `src/main.js` at `dist/main-a340d0ae.js`

</details>

# Building a frontend

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

There is a pre configured GitHub repository for this use case: [jsenv-template-pwa](https://github.com/jsenv/jsenv-template-pwa#jsenv-template-for-pwa-progressive-web-application).

If you want to build a PWA, you certainly got a service worker file. In that case use `serviceWorkers` parameter. Otherwise, your service worker file is ignored and does not appear in the build directory. For each service worker file specified in `serviceWorkers` a corresponding file will be written to the build directory. Building a service worker is almost equivalent to copying files from project directory to build directory. Two optimizations are still peformed:

- `self.importScripts` are inlined
- The final service worker file is minified

Your service worker file must be written in a way browser can understand. Service worker are totally different from js executing in a browser tab. They don't have `import` or `export` keywords for instance and jsenv won't transform them for you.

> Service workers and regular js are very different. Trying to blur these differences would be hard to do AND complex AND confusing.

```js
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  serviceWorkers: {
    "./sw.js": "./sw.js",
  },
})
```

If you didn't change meaningful files, building your project outputs exactly the same service worker file. In that case your service worker is not updated -> users keep their current service worker. Otherwise, browser will see that something has changed and start the process to update the service worker.

### Jsenv service worker

If you want, jsenv has its own service worker. Read more at https://github.com/jsenv/jsenv-pwa/blob/master/docs/jsenv-service-worker.md

If you use it be sure to add `serviceWorkerFinalizer` parameter to buildProject:

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

[jsenvServiceWorkerFinalizer](../../src/jsenvServiceWorkerFinalizer.js) configure service worker with the list of urls to cache and if they are versioned or not.

# Building a Node.js package

There is a pre configured GitHub repository for this use case: [jsenv-template-node-package](https://github.com/jsenv/jsenv-template-node-package).

A Node.js package does not have the same constraints than the web. If you are targeting recent Node.js versions you can even skip the build step completely and serve your files untouched.

## Building a commonjs package

If you want to publish a version of your files compatible with commonjs you can use the following script.

> If any of your js file uses on top level await, jsenv will throw an error because it's not supported.

<details>
  <summary>generate-commonjs-build.js</summary>

```js
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  entryPointMap: {
    "./main.js": "./main.cjs",
  },
  format: "commonjs",
})
```

</details>

You can even generate a commonjs build to be compatible with a specific node version with the following script.

<details>
  <summary>generate-commonjs-build-advanced.js</summary>

```js
import { buildProject, getBabelPluginMapForNode } from "@jsenv/core"

// you can enable a subset of babel plugins transformations
// to get only thoose required to work with node 8
const babelPluginMapForNode8 = getBabelPluginMapForNode({
  nodeMinimumVersion: "8.0.0",
})

// calling getBabelPluginMapForNode() without specifying nodeMinimumVersion
// returns a babel plugin map computed from process.version
const babelPluginMapForCurrentNodeVersion = getBabelPluginMapForNode()

buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  format: "commonjs",
  babelPluginMap: babelPluginMapForNode8,
})
```

</details>

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

You can disable url versioning if you don't want it using `urlVersioning` parameter as shown below:

```js
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  format: "esmodule",
  urlVersioning: false,
})
```

— link to Babel on GitHub: https://github.com/babel/babel<br />
— link to PostCSS on GitHub: https://github.com/postcss/postcss<br />
— link to parse5 on GitHub: https://github.com/inikulin/parse5

## SystemJS format

JavaScript modules, also called ES modules, refers to the browser support for the `import` and `export` keywords.

> For a more detailed explanation about JavaScript modules, see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules

By default jsenv generates files assuming the browser will support JavaScript modules. But for reasons detailed below you might want to output files using the `"systemjs"` format.

If you want any of the benefits of [import maps](#import-maps) and/or [top level await](#top-level-await), you must use SystemJS format until browser supports them natively.

To use SystemJS format, use `format` parameter

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

<details>
  <summary>dist/main.html</summary>

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

</details>

When using this format the html generated is a bit different:

- `<script type="module">` are transformed into `<script type="systemjs-module">`
  > This also means html becomes compatible with browser that does not support `<script type="module"></script>`.
- `<script type="importmap">` are transformed into `<script type="systemjs-importmap">`

- `<script src="assets/s.min-550cb99a.js"></script>` was injected into `<head>`

  > This is to provide `window.System` needed by SystemJS.

  > If you have no `<script type="module"></script>` in the html file, this script is not needed so it's no injected in `<head>`

— Link to SystemJS on GitHub: https://github.com/systemjs

#### import maps

Import maps is a standard that is starting to be supported by runtimes such as Node.js, deno, and Web browsers. It is the future proof way of controlling how js imports are resolved.

Import maps drastically improve reuse of files configured with [Long term caching](#Long-term-caching). Without import maps `1` modification invalidates `n` files in cache. With import maps `1` modification invalidates `1` file in cache. They also enable a standard way to remap imports that improves developper experience.

<details>
  <summary>See details on how import maps improves cache reuse</summary>

Without import maps, changing a file content updates its unique url with hash and all files referencing that url (directly or indirectly) must be updated. To illustrate, let's say you have three js files:
`main.js` importing `dependency.js` which is importing `foo.js`. You have a dependency tree between files that looks like this:

```console
main.js
  └── dependency.js
          └────── foo.js
```

You can generate build files a first time, dependency tree becomes:

```console
main-x3rdf.js
  └── dependency-vjdt3.js
          └────── foo-rtiu76.js
```

At this point browser puts the 3 urls in cache.

Later, you update `foo.js`:

1. jsenv computes `foo.js` url -> `foo-newhash.js`.
2. jsenv updates `dependency.js` so that `import "./foo.js"` becomes `import "./foo-newhash.js"`
3. jsenv also needs to update `main.js` because `dependency.js` have changed.

In the end 1 file is modified but 3 urls needs to be updated.

Import maps allows to tell browser exactly which files have changed and reuse the ones that are not modified.

</details>

<details>
  <summary>See details on how import maps improves developer experience</summary>
  The ability to remap imports is important to simplify the developper experience when reading and writing imports.

```js
import "../../file.js"
// vs
import "src/feature/file.js"
```

This unlock consistent import paths accross the codebase which helps a lot to know where we are. As import maps is a standard, tools (VSCode, ESLint, Webpack, ...) will soon use them too.

The following html will be supported natively by browsers:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <script type="importmap">
      {
        "imports": {
          "src/": "./src/"
        }
      }
    </script>
  </head>

  <body>
    <script type="module">
      import "src/feature/file.js"
    </script>
  </body>
</html>
```

</details>

— Link to import maps specifications on GitHub: https://github.com/WICG/import-maps

#### top level await

Top level await is the ability to write `await` at the top level of your program.

```js
const a = await Promise.resolve(42)

export default a
```

Top level await, depites being useful, is not yet supported by browsers as reported in chrome platform status: https://www.chromestatus.com/feature/5767881411264512. By using SystemJS format it becomes possible to use it right now.

## Disable concatenation

By default js files are concatenated as much as possible. There is legitimates reasons to disable this behaviour. Merging `n` files into chunks poses two issues:

- On a big project it becomes very hard to know what ends up where.
  Tools like [webpack bundle analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer) exists to mitigate this but it's still hard to grasp what is going on.
- When a file part of a chunk is modified the entire chunk must be recreated. A returning user have to redownload/parse/execute the entire chunk even if you modified only one line in one file.

Disabling concatenation will fixe these two issues, but also means browser will have to create an http request per file. Thanks to http2, one connection can be reused to serve `n` files meaning concatenation becomes less crucial.

> It's still faster for a web browser to donwload/parse/execute one big file than doing the same for 50 tiny files.

I would consider the following before disabling concatenation:

- Is production server compatible with http2 ?
- Is there a friendly loading experience on the website ? (A loading screen + a progress bar for instance) ?
- What type of user experience I want to favor: new users or returning users ?

Concatenation cannot be disabled because rollup cannot do that. It should be possible with rollup 3.0 as stated in https://github.com/rollup/rollup/issues/3882. Whenever rollup makes it possible it will become possible to use `jsConcatenation` parameter to disable concatenation.

```js
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  format: "esmodule",
  jsConcatenation: false,
})
```
