# C) Build

This page documents how jsenv can be used to generate an optimized version of source files into a directory.

# 1. How to build source files

A build will be added to a project with the following file structure:

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

Before generating a build, install dependencies with the following command:

```console
npm i --save-dev @jsenv/core
```

Everything is ready, build can be generated with the following command:

```console
node ./scripts/build.mjs
```

It will display the following output in the terminal:

```console
build "./index.html"
✔ generate source graph (done in 0.01 second)
✔ generate build graph (done in 0.004 second)
✔ inject version in urls (done in 0.003 second)
--- build files ---
- html : 1 (173 B / 100 %)
- total: 1 (173 B / 100 %)
```

# 2. Features

## 2.1 Entry points

TODO:

- [ ] Explain entryPoints parameter.
  - There can be many
  - Used to decide name of files in dist directory
  - Entry point is usually HTML but it can be js, css, svg, ...
  - "Object describing project entry points. Keys are relative path leading to files, values becomes the name of the file inside the build directory."

## 2.2 Browser support

By default build generates code compatible with the following browsers:

- Chrome 64+
- Safari 11.3+
- Edge 79+
- Firefox 67+
- Opera 51+
- Safari on IOS 12+
- Samsung Internet 9.2+

All things **part of web standards** for HTML, CSS and JavaScript are transformed accordingly. This includes for instance:

- `<script type="module">`
- top level `await`
- import assertions
- etc...

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

The maximum compatibility that can be achieved:

- Chrome 7+
- Safari 5.1+
- Edge 12+
- Firefox 2+
- Opera 12+
- Safari on IOS 6+
- Samsung Internet 1+

## 2.3 Same build for all browsers

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

## 2.4 Polyfills

Build does not inject polyfills. If code uses `Promise` and needs to be compatible with browsers that do not support `Promise`, the polyfill must be added. (suggestion: https://polyfill.io<sup>↗</sup>).

## 2.3 versioning

Boolean controlling if url specifiers are versioned inside build file contents.

Effect of disabling versioning on a js module:

```diff
- import "/js/file.js?v=16e5f70d"
+ import "/js/file.js"
```

### 2.3.1 versioningMethod

When versioningMethod is not specified, the version is injected as url search param

```js
import "/js/file.js?v=16e5f70d";
```

When versioningMethod is `"filename"` the version is part of the file name in the build directory.

```diff
- import "/js/file.js?v=16e5f70d"
+ import "/js/file-16e5f70d.js"
```

## 2.4 Build directory structure

For a build directory named "dist" a typical build end up with a file structure similar to:

```
dist/
  js/
    main.js
    app.js
  css/
    main.css
  main.html
```

The following code uses `assetsDirectory` to change that structure:

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
  main.html
```

## 2.5 base

A string used to prefix all asset url specifiers.

Using `base: "https://cdn.example.com"` puts base in front of every url specifiers. Applied to an import inside a js module it would have the following effect:

```diff
- import "/js/file.js"
+ import "https://cdn.example.com/js/file.js"
```

## 2.6 Minification

TODO

## 2.7 Bundling

TODO

## 2.8 Resource hints

TODO:

- [ ] When code splitting introduce intermediate files, resource hints are injected (show example with source code + terminal output)
- [ ] if file is bundled, resource hint is removed + a warning is logged (show example with source code + terminal output)
- [ ] if there is useless resource hint(s), warning as well in the console (show example with source code + terminal output)
- [ ] Attributes are updated to match the generated files (rel="modulepreload", crossorigin, ...) (show example with source code + terminal output)
- [ ] href use the versioned url

## 2.9 Precise cache invalidation

TODO:

- [ ] Jsenv maintains a global mapping leading to versioned urls -> when a file is modified, only that file cache needs to be invalidated (maybe a link to https://bundlers.tooling.report/hashing/avoid-cascade/?)

## 2.10 plugins

Array of custom jsenv plugins that will be used while building files.  
Read more in [I) Jsenv-plugins](./i_jsenv_plugins.md).

## 2.11 Symbiosis with service worker

TODO:

- [ ] If a service worker is used, jsenv build injects resources info into service worker. Can be used to let service worker put all resources into browser cache and make page work offline for instance.

## 2.12 sourcemaps

Same as `sourcemaps` in [B) Dev](./b_dev.md#28-sourcemaps>) but default value is `"none"`

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

Same as https in [B) Dev](./b_dev.md#210-https)

<table>
 <tr>
  <td width="2000px" align="left" nowrap>
   <a href="./b_dev.md">< B) Dev</a>
  </td>
  <td width="2000px" align="right" nowrap>
   <a href="./d_test.md">> D) Test</a>
  </td>
 </tr>
<table>
