# F) Features

<!-- PLACEHOLDER_START:TABLE_OF_CONTENT -->

<details open>
  <summary>F) Features</summary>
  <ul>
    <li>
      <a href="#1-node-esm-resolution">
        1. Node ESM resolution
      </a>
        <ul>
          <li>
            <a href="#11-node-module-files-during-dev">
              1.1 Node module files during dev
            </a>
          </li>
        </ul>
    </li>
    <li>
      <a href="#2-magic-extensions">
        2. Magic extensions
      </a>
    </li>
    <li>
      <a href="#3-importmetadev">
        3. import.meta.dev
      </a>
    </li>
    <li>
      <a href="#4-injections">
        4. Injections
      </a>
    </li>
    <li>
      <a href="#5-inlining">
        5. Inlining
      </a>
    </li>
    <li>
      <a href="#6-importing-umd">
        6. Importing UMD
      </a>
    </li>
    <li>
      <a href="#7-importing-commonjs">
        7. Importing CommonJs
      </a>
    </li>
    <li>
      <a href="#8-loading-js-module-with">
        8. Loading js module with 
      </a>
    </li>
  </ul>
</details>

<!-- PLACEHOLDER_END -->

# 1. Node ESM resolution

Jsenv implements Node ESM resolution on js imports.

Without node esm resolution, the following code would throw when executed in a browser:

```js
import "amazing-package";
```

To be compatible with browsers, "amazing-package" is resolved and transformed into:

```js
import "/node_modules/amazing-package/index.js";
```

See some of the features provided by Node ESM resolution:

- [Self referencing a package using its name](https://nodejs.org/docs/latest-v18.x/api/packages.html#self-referencing-a-package-using-its-name)<sup>↗</sup>
- [Subpath exports](https://nodejs.org/docs/latest-v18.x/api/packages.html#subpath-exports)<sup>↗</sup>
- [Subpath imports](https://nodejs.org/docs/latest-v18.x/api/packages.html#subpath-imports)<sup>↗</sup>

## 1.1 Node module files during dev

During dev import inside node modules are versioned by their _package.json_ `"version"` field:

```js
import "/node_modules/amazing-package/index.js?v=1.0.0";
```

☝️ Here _amazing-package/package.json_ contains `"version": "1.0.0"`

It allows to put node modules files into the browser cache. The cache duration is **1 year**.  
A nice bonus: the version of the package is easy to spot.

<!--
It is possible to control in which files node esm resolution applies, code below would enable it inside HTML and CSS:

```diff
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
+ nodeEsmResolution: {
+    html: true,
+    css: true,
+    js_module: true,
+ },
});

import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: { "./main.html": "main.html" },
+ nodeEsmResolution: {
+    html: true,
+    css: true,
+    js_module: true,
+ },
});
```
-->

# 2. Magic extensions

> **Warning**
> Magic extensions are fading away from the JavaScript ecosystem, it's recommended to avoid them. However many packages are still relying on this behaviour.

Jsenv implements file magic extensions on js imports.  
Without it the code below would throw 404 in a browser (assuming there is no "file" but "file.js")

```js
import "./file";
```

"file" must be resolved and transformed into:

```js
import "./file.js";
```

Magic extensions can be disabled as follows:

```diff
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL('../', import.meta.url),
+  magicExtensions: null,
+  magicDirectoryIndex: false,
});

import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: { "./main.html": "main.html" },
+  magicExtensions: null,
+  magicDirectoryIndex: false,
});
```

# 3. import.meta.dev

`import.meta.dev` can be used to make code behave differently during dev and after build.<br />
During build code specific to dev is marked as dead and removed.

```js
if (import.meta.dev) {
  console.log("during dev"); // logged when executing source files
} else {
  console.log("after build"); // logged when executing files after build
}
```

# 4. Injections

Jsenv can inject variables in file contents.

For a file _main.js_ with the following content:

```js
// eslint-disable-next-line no-undef
window.__ENV__ = __ENV__;
console.log(window.__ENV__);
```

Code below replaces `__ENV__` inside _main.js_ during dev before serving it to the browser.

```diff
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
+ injections: {
+   "./main.js": () => {
+     return { __ENV__: "dev" }
+   },
+ },
});
```

The browser will see the following file content:

```diff
// eslint-disable-next-line no-undef
+ window.__ENV__ = "dev";
console.log(window.__ENV__);
```

Code below replaces `__ENV__` inside _main.js_ during build.

```diff
import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: { "./main.html": "main.html" },
+ injections: {
+   "./main.js": () => {
+     return { __ENV__: "build" };
+   },
+ },
});
```

The build file content:

```diff
// eslint-disable-next-line no-undef
+ window.__ENV__ = "build";
console.log(window.__ENV__);
```

It's possible to put injection logic into a single function:

```js
// inside utils.mjs
export const getInjections = () => {
  return {
    "./main.js": (urlInfo) => {
      return {
        __ENV__: urlInfo.context.dev ? "dev" : "build",
      };
    },
  };
};

// inside dev.mjs
import { startDevServer } from "@jsenv/core";
import { getInjections } from "./utils.mjs";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  injections: getInjections(),
});

// inside build.mjs
import { build } from "@jsenv/core";
import { getInjections } from "./utils.mjs";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: { "./main.html": "main.html" },
  injections: getInjections(),
});
```

And the function can be async:

```js
export const getInjections = () => {
  return {
    "./main.js": async () => {
      const value = await Promise.resolve("toto");
      return { __ENV__: value };
    },
  };
};
```

# 5. Inlining

It can be handy to put code that is meant to be inlined in a separate file.  
This is doable by adding `inline` query parameter when referencing a file.

_demo.html_:

```html
<!doctype html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
  </head>

  <body>
    <script src="./demo.js?inline"></script>
  </body>
</html>
```

_demo.js_:

```js
console.log("Hello world");
```

Dev server and build ensure "demo.js" gets inlined into "demo.html" as follows:

```html
<!doctype html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
  </head>

  <body>
    <script>
      console.log("Hello world");
    </script>
  </body>
</html>
```

Inlining can also be used to inline code written as js module:

```html
<!doctype html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
  </head>

  <body>
    <script src="./demo.js?as_js_classic&inline"></script>
  </body>
</html>
```

Read more about `as_js_classic` query parameter in [G) Plugins#asJsClassic](../g_plugins/plugins.md#22-asjsclassic)

# 6. Importing UMD

UMD stands for Universal Module Definition. For a detailed explanation go to [What are UMD modules?](https://jameshfisher.com/2020/10/04/what-are-umd-modules/)<sup>↗</sup>.

Such code can be imported directly as shown in the example below applied to jQuery:

```js
import "jquery";

const jquery = window.$;
```

But some packages would throw in this situation with the following error:

```console
Cannot set property 'xxx' of undefined`
```

This happens because in a js module, `this` at the top level is `undefined`. hls.js library suffers from this for instance, see [video-dev/hls.js/#2911](https://github.com/video-dev/hls.js/issues/2911)<sup>↗</sup>.

In this situation put "as_js_module" query param on the import:

```js
import "hls.js?as_js_module";

window.Hls;
```

# 7. Importing CommonJs

Let's see what happens if we try to execute code using CommonJs in a browser.

> This example is simplified but correspond to what happens when code imports a package written in CommonJs, like react.

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
    <script type="module" src="./main.js"></script>
  </body>
</html>
```

_main.js_:

```js
module.exports = 42;
```

Opening _index.html_ in a browser would lead to the following error:

```console
Uncaught ReferenceError: module is not defined
```

Obviously.  
And jsenv won't try to perform automatic module conversion. The conversion to js modules must be done using `jsenvPluginCommonJs` documented in [G) Plugins#commonjs](../g_plugins/plugins.md#21-commonjs).

# 8. Loading js module with `<script></script>`

Let's see what happens if we try to load a js module with a regular script tag

_index.html_:

```html
<script src="./file.js">
```

_file.js_:

```js
console.log(import.meta.url);
```

Opening _index.html_ in a browser would lead to the following error:

```console
Uncaught SyntaxError: Cannot use import statement outside a module
```

It is normal, `<script type="module">` must be used to load js module.

However in specific cases we want things from both worlds:

- Features from js modules (import and dynamic import)
- The behaviour of classic script tag: prevent execution of further scripts until this one is done

It's possible to obtain this thanks to `jsenvPluginAsJsClassic` documented in [G) Plugins#asJsClassic](../g_plugins/g_plugins.md#22-asjsclassic).

<!-- PLACEHOLDER_START:PREV_NEXT_NAV -->

<table>
 <tr>
  <td width="2000px" align="left" nowrap>
   <a href="../e_referencing_files/e_referencing_files.md">&lt; E) Referencing files</a>
  </td>
  <td width="2000px" align="right" nowrap>
   <a href="../g_plugins/g_plugins.md">&gt; G) Plugins</a>
  </td>
 </tr>
<table>

<!-- PLACEHOLDER_END -->
