# Table of contents

- [Presentation](#Presentation)
- [Minification](#Minification)
- [Long term caching](#Long-term-caching)
- [JavaScript modules](#JavaScript-modules)
  - [SystemJS format](#SystemJS-format)
    - [import maps](#import-maps)
    - [top level await](#top-level-await)
- [Concatenation](#Concatenation)
- [Building a frontend](#Building-a-frontend)
  - [Embed frontend](#Embed-frontend)
- [Building a Node.js package](#Building-a-nodejs-package)
- [API](./build-api.md)

# Presentation

Building consists into taking one or many input files to generate one or many output files. It creates a step between dev and production where you can perform specific optimizations:

- File concatenation to save http request
- Minify file content to reduce file size
- Hash url to enable long term caching
- Transform file content to support more execution environments (old browsers for instance)

# Minification

Minification is enabled by default when `process.env.NODE_ENV` is `"production"` and disabled otherwise. When enabled: js, css, html, importmap, json, svg are minified.

You can manually control this parameter like this:

```js
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  minify: true,
})
```

# Long term caching

Long term caching consists into configuring a web server to send a `cache-control` header when serving your files. When doing so, browser caches the file for the duration configured by the server and won't even ask the server if the file changed for subsequent requests.

The screenshot belows shows how a 144kB file takes 1ms for the browser to fetch in that scenario.

![screenshot showing request with long term cahcing](./long-term-caching-from-cache.png)

> An article to explain long term caching: https://jakearchibald.com/2016/caching-best-practices/#pattern-1-immutable-content--long-max-age

This is a massive boost in performance but can be tricky to setup because you need to know how and when to invalidate browser cache. Jsenv allows you to use long term caching if you want because it computes a unique url for each file and update any reference to that url accordingly.

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

If you don't want to change urls to enable long term caching use `longTermCaching` parameter.

```js
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  longTermCaching: false,
})
```

— link to Babel on GitHub: https://github.com/babel/babel<br />
— link to PostCSS on GitHub: https://github.com/postcss/postcss<br />
— link to parse5 on GitHub: https://github.com/inikulin/parse5

## JavaScript modules

JavaScript modules, also called ES modules, refers to the browser support for the `import` and `export` keywords.

> For a more detailed explanation about JavaScript modules, see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules

By default jsenv generates files assuming the browser will support JavaScript modules. But for reasons detailed below you might want to output files using the [SystemJS format](#SystemJS-format)

### SystemJS format

If you want any of the benefits of [import maps](#import-maps) and/or [top level await](#top-level-await), you must use SystemJS format until browser supports them natively.

To use SystemJS format, use `format` parameter

```js
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryRelativeUrl: "dist",
  enryPointMap: {
    "./index.html": "main.html",
  },
  minify: false,
  format: "systemjs",
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

## Concatenation

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
  jsConcatenation: false,
})
```

# Building a frontend

A frontend is composed of files that will be executed by a browser (Chrome, Firefox, ...). In other words you need to generate an html file and the files needed by this html file.

To do that provide your main html to jsenv. It will collect all the files used directly or indirectly by the html file. Once all the files are known they are eventually minified, concatenated and file urls are replaced with a unique url identifier to enable long term caching.

```js
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  format: "systemjs",
})
```

## Embed front end

Embed refers to a product that is meant to be injected into website you don't own, like a video embed for instance. In that case, developper using your product can inject it in their web page using an iframe.

```html
<iframe src="dist/main.html"></iframe>
```

# Building a Node.js package

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

> For be explicit `entryPointMap` is shown in the code above but you could omit it. This is the default value when format is `commonjs`

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
