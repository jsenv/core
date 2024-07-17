# C) Build

This page documents how jsenv can be used to generate an optimized version of source files into a directory.

Best parts of jsenv build:

- Large browser support
- Support all features related to js modules
  - `<script type="importmap">`
  - `import.meta.url`, `import.meta.resolve`
  - top level await
  - worker type module
- [Precise cache invalidation](#26-precise-cache-invalidation)

# 1. Usage

This section shows how to build project source files using jsenv.

## 1.1 Project file structure

<pre>
project/
  src/
    index.html
  package.json
</pre>

Adding a build have the following impacts on that file structure:

```diff
project/
+ dist/
+   index.html
+ scripts/
+    build.mjs
  src/
    index.html
  package.json
```

_scripts/build.mjs_:

```js
import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./index.html": "index.html",
  },
});
```

## 1.2 Generating a build

Before generating a build, install dependencies with the following command:

```console
npm i --save-dev @jsenv/core
```

Everything is ready, build can be generated with the following command:

```console
node ./scripts/build.mjs
```

It will display the following output in the terminal:

![build](https://github.com/user-attachments/assets/be0acaf4-6607-4b68-9602-4a78c0145713)

# 2. Features

## 2.1 Browser support

By default build generates code compatible with the following browsers:

- Chrome 64+
- Safari 11.3+
- Edge 79+
- Firefox 67+
- Opera 51+
- Safari on IOS 12+
- Samsung Internet 9.2+

The browser support can be increased or decreased using `runtimeCompat`:

```diff
import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl:new URL("../dist/", import.meta.url),
  entryPoints: {
    "./main.html": "index.html",
  },
+  runtimeCompat: {
+    chrome: "55",
+    edge: "15",
+    firefox: "52",
+    safari: "11",
+  },
});
```

Build ensure transformations are performed according to the browser support: if `<script type="module">` can be preserved, they will be.

### 2.1.1 Maximal browser support

The maximum compatibility that can be obtained after build is:

- Chrome 7+
- Safari 5.1+
- Edge 12+
- Firefox 2+
- Opera 12+
- Safari on IOS 6+
- Samsung Internet 1+

### 2.1.2 Same build for all browsers

When `runtimeCompat` contains browsers not supporting `<script type="module"></script>` it is tempting to think the good thing to do is to generate 2 builds and use [`<script nomodule>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#attr-nomodule)<sup>↗</sup>.

<!-- prettier-ignore -->
```html
<!-- this is NOT what jsenv does -->
<script
 type="module"
 src="/dist/main.js"
></script>
<script
  nomodule
  src="/dist/main.nomodule.js"
></script>
```

This has been tried on a big codebase served to a lot of users.
The result: there is no significant performance impact for users.
Moreover generating a second set of files has costs:

- Manual tests must be runned also on old browsers
- Automated tests as well
- Finally it takes more time to generate the build

For these reasons jsenv generates a single `<script>` tag.

```html
<!-- this is what jsenv does -->
<script src="/dist/main.nomodule.js"></script>
```

> **Note**
> It's still possible to obtain X set of files by calling `build` multiple times with their own `runtimeCompat` and `buildDirectoryUrl`.

### 2.1.3 Polyfills

Build does not inject polyfills. If code uses `Promise` and needs to be compatible with browsers that do not support `Promise`, the polyfill must be added. (suggestion: https://polyfill.io<sup>↗</sup>).

## 2.2 Build directory structure

A typical build end up with a file structure similar to:

```
dist/
  js/
    main.js
    app.js
  css/
    main.css
  index.html
```

### 2.2.1 Entry points

Entry points is an object describing the source files to build. It can be any type of file: HTML, CSS, JS, ...<br />
Entry point values are used to control the name of the source file inside the build directory:

```js
import { build } from "@jsenv/build";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./index.html": "index_after_build.html",
    "./about.html": "about_after_build.html",
  },
});
```

```
dist/
  js/
    main.js
    app.js
  css/
    main.css
  index_after_build.html
  about_after_build.html
```

### 2.2.2 Assets directory

It's possible to regroup assets into a dedicated directory using `assetsDirectory` parameter:

```js
import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./index.html": "index.html",
  },
  assetsDirectory: "assets/",
});
```

Resulting in the following structure in the build directory:

```
dist/
  assets/
    js/
      main.js
      app.js
    css/
      main.css
  index.html
```

## 2.3 Bundling

Bundling drastically reduces the number of files after build by concatenating file contents. It is enabled by default.

The bundlers used under the hood are described in the table below:

| File type | bundler used under the hood                                                 |
| --------- | --------------------------------------------------------------------------- |
| js module | [rollup](https://github.com/rollup/rollup)<sup>↗</sup>                     |
| css       | [lightningcss](https://github.com/parcel-bundler/lightningcss)<sup>↗</sup> |

Use an object to configure what is bundled:

```js
import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./index.html": "index.html",
  },
  bundling: {
    js_module: false,
    css: true,
  },
});
```

Or pass `bundling: false` to disable bundling entirely.

### 2.3.1 Js module chunks

`chunks` parameter can be used to assign source files to build files. The code below puts the content of node module files and _a.js_ inside _vendors.js_:

```js
import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./index.html": "index.html",
  },
  bundling: {
    js_module: {
      chunks: {
        vendors: {
          "file:///**/node_modules/": true,
          "./a.js": true,
        },
      },
    },
  },
});
```

The source files not assigned by `chunks` are distributed optimally into build files.

## 2.4 Minification

Minification decreases file size. It is enabled by default.

The minifiers used under the hood are described in the table below:

| File type                | Minifier used under the hood                                                |
| ------------------------ | --------------------------------------------------------------------------- |
| js module and js classic | [terser](https://github.com/terser/terser)<sup>↗</sup>                     |
| html and svg             | [html-minifier](https://github.com/kangax/html-minifier)<sup>↗</sup>       |
| css                      | [lightningcss](https://github.com/parcel-bundler/lightningcss)<sup>↗</sup> |
| json                     | White spaces are removed using JSON.stringify                               |

Use an object to configure what is minified:

```js
import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./index.html": "index.html",
  },
  minification: {
    html: false,
    css: true,
    js_classic: true,
    js_module: true,
    json: false,
    svg: false,
  },
});
```

Or pass `minification: false` to disable minification entirely.

## 2.5 Build urls

Inside build files, url paths is absolute and versioned by default.

_src/index.html_:

```html
<script type="module" src="./main.js"></script>
```

Becomes the following _dist/index.html_:

```html
<script type="module" src="/js/main.js?v=16e5f70d"></script>
```

### 2.5.1 Base

It's possible to configure the build urls to obtain the following:

```diff
- <script type="module" src="/js/main.js?v=16e5f70d"></script>
+ <script type="module" src="https://cdn.example.com/js/main.js?v=16e5f70d"></script>
```

Example of code putting `"https://cdn.example.com"` in front of every urls in the build file contents:

```js
import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./main.html": "index.html",
  },
  base: "https://cdn.example.com",
});
```

### 2.5.2 Versioning

When versioning method is not specified, the version is injected as url search param:

```html
<script type="module" src="/js/main.js?v=16e5f70d"></script>
```

Effect of filename versioning method:

```diff
- <script type="module" src="/js/main.js?v=16e5f70d"></script>
+ <script type="module" src="/js/main-16e5f70d.js"></script>
```

Effect of disabling versioning:

```diff
- <script type="module" src="/js/main.js?v=16e5f70d"></script>
+ <script type="module" src="/js/main.js"></script>
```

Example of code using filename versioning method:

```js
import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./main.html": "index.html",
  },
  versioningMethod: "filename",
});
```

Example of code disabling versioning:

```js
import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./main.html": "index.html",
  },
  versioning: false,
});
```

## 2.6 Precise cache invalidation

Build [avoids cascading hash changes](https://bundlers.tooling.report/hashing/avoid-cascade/)<sup>↗</sup> using [`<script type="importmap">`](https://github.com/WICG/import-maps)<sup>↗</sup>.

The following browsers are supporting importmap:

- Chrome 89+
- Safari 16.4+
- Edge 89+
- Firefox 108+
- Opera 76+
- Safari on IOS 16.4+
- Samsung Internet 15+

If something in the `runtimeCompat` configured for the build does not support importmap, build converts js modules to the [systemjs format](https://github.com/systemjs/systemjs). This allow to keep versioning urls without introducing cascading hash changes.

## 2.7 Resource hints

If source file contains resource hints, they are updated by the build to reflect the state of the files after build.
In some situations build will also inject resource hints and/or remove useless ones.

### 2.7.2 Resource hint injection

In a project with the following file structure

```
project/
 src/
   boot.js
   app.js
   index.html
   ...many js files...
```

With _index.html_ preloading _boot.js_ and _app.js_:

```html
<link rel="preload" href="./boot.js" as="script" crossorigin="" />
<link rel="preload" href="./app.js" as="script" crossorigin="" />
```

During build, code shared by _boot.js_ and _app.js_ might be put into an intermediate file to improve code reuse.
In that case build will inject a preload link to that new file introduced during build:

```html
<link rel="preload" href="/js/boot.js?v=12345678" as="script" crossorigin="" />
<link
  rel="preload"
  href="/js/generated.js?v=12367845"
  as="script"
  crossorigin=""
/>
<link rel="preload" href="/js/app.js?v=87654321" as="script" crossorigin="" />
```

### 2.7.1 Resource hint removal

```html
<link rel="preload" href="./main.js" as="script" crossorigin="" />
```

☝️ Assuming nothing else in the code is referencing "main.js", the following warning is logged during build

```console
⚠ remove resource hint because cannot find "file:///demo/main.js" in the graph
```

To remove this warning, remove the resource hint from the html file.

A similar warning is logged whenever a file is no longer needed after build (like when the file is bundled into an other). In that case the warning is a bit different

```console
⚠ remove resource hint on "file:///demo/main.js" because it was bundled
```

Here again, remove the resource hint from the html file as it becomes useless after build.

## 2.8 plugins

Array of custom jsenv plugins that will be used while building files.  
Read more in [G) Plugins](<G)-Plugins>).

## 2.9 Symbiosis with service worker

Let's see what happens during build when some code registers a service worker:

_index.html_:

```html
<!doctype html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
  </head>

  <body>
    Hello world
    <script type="module" src="./main.js"></script>
    <script>
      window.navigator.serviceWorker.register("./sw.js");
    </script>
  </body>
</html>
```

_sw.js_:

```js
const urls = ["/"];

const addUrlsToCache = async (urls) => {
  const cache = await caches.open("v1");
  await cache.addAll(urls);
};

self.addEventListener("install", (event) => {
  event.waitUntil(addUrlsToCache(urls));
});
```

1. build recognize `navigator.serviceWorker.register` and consider _sw.js_ is a service worker entry file.
2. build injects code at the top of _sw.js_:

```diff
+ self.resourcesFromJsenvBuild = {
+  "/main.html": {
+    "version": "a3b3b305"
+  },
+  "/js/main.js": {
+    "version": "54f517a9",
+    "versionedUrl": "/js/main.js?v=54f517a9"
+  },
+ };
```

Thanks to this the service worker becomes aware of all the files generated during the build. It can use this information to put all urls into browser cache and make the page work offline for instance.

To do this the code inside _sw.js_ need to be adjusted a bit:

```diff
  const urls = ["/'];

+ const resourcesFromJsenvBuild = self.resourcesFromJsenvBuild;
+ if (resourcesFromJsenvBuild) {
+   Object.keys(resourcesFromJsenvBuild).forEach((key) => {
+     const resource = resourcesFromJsenvBuild[key]
+     if (resource.versionedUrl) {
+       urls.push(resource.versionedUrl);
+     }
+   });
+ }
```

In case you don't have your own service worker already you can use [@jsenv/service-worker](../../../packages/independent/service-worker)

## 2.10 sourcemaps

Same as `sourcemaps` in [B) Dev](../b_dev/dev.md#28-sourcemaps) but default value is `"none"`

# 3. How to serve build files

Start a server for build files; Acts as a server for static files without any logic.

```js
import { startBuildServer } from "@jsenv/core";

const buildServer = await startBuildServer({
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  port: 8000,
});
```

## 3.1 buildDirectoryUrl

A string or url leading to the directory where build files are written. This parameter is **required**.

## 3.2 port

Number listened by the build server (default is 9779). `0` listen a random available port.

## 3.3 https

Same as https in [B) Dev](../b_dev/b_dev.md#210-https)

<!-- PLACEHOLDER_START:PREV_NEXT_NAV -->
<table>
 <tr>
  <td width="2000px" align="left" nowrap>
   <a href="../b_dev/b_dev.md">&lt; B) Dev</a>
  </td>
  <td width="2000px" align="right" nowrap>
   <a href="../d_test/d_test.md">&gt; D) Test</a>
  </td>
 </tr>
<table>
<!-- PLACEHOLDER_END -->
