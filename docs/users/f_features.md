# F) Features

# 1. Node ESM resolution

Without node esm resolution, the following code would throw when executed in a browser:

```js
import "amazing-package";
```

To be compatible with browsers, "amazing-package" is resolved and transformed into:

```js
import "/node_modules/amazing-package/index.js";
```

During dev import inside node modules are versioned using `"version"` found in their _package.json_:

```js
import "/node_modules/amazing-package/index.js?v=1.0.0";
```

☝️ Here _amazing-package/package.json_ contains `"version": "1.0.0"`

It allows to put node modules files into the browser cache according to the version found in its _package.json_. The cache duration is 1 year. A nice side effect: the version of the package being used is easy to spot.

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

Note that the whole Node ESM resolution is implemented so the following can also be used:

- [Self referencing a package using its name](https://nodejs.org/docs/latest-v18.x/api/packages.html#self-referencing-a-package-using-its-name)<sup>↗</sup>
- [Subpath exports](https://nodejs.org/docs/latest-v18.x/api/packages.html#subpath-exports)<sup>↗</sup>
- [Subpath imports](https://nodejs.org/docs/latest-v18.x/api/packages.html#subpath-imports)<sup>↗</sup>

# 2. Magic extensions

> **Warning**
> Magic extensions are fading away from the JavaScript ecosystem, it's recommended to avoid them. However many packages are still relying on this behaviour.

Jsenv implements file magic extensions inside js modules.  
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

# 3. Importing UMD

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

# 4. Importing CommonJs

Let's see what happens if we try to execute code using CommonJs in a browser.

> This example is simplified but correspond to what happens when code is importing from a package written in CommonJs, like react.

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

Obviously. And jsenv won't try to perform automatic module conversion. The conversion to js modules must be done using `jsenvPluginCommonJs` documented in [G) Jsenv plugins#commonjs](<G)-Jsenv-plugins#43-commonjs>).

# 5. import.meta.dev

`import.meta.dev` can be used to make code behave differently during dev and after build.<br />
During build code specific to dev is marked as dead and removed.

```js
if (import.meta.dev) {
  console.log("during dev"); // logged when executing source files
} else {
  console.log("after build"); // logged when executing files after build
}
```

# 6. Inlining

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

Read more about `as_js_classic` query parameter in [jsenvPluginAsJsClassic](./i_jsenv_plugins.md#6-jsenvPluginAsJsClassic>)

<table>
 <tr>
  <td width="2000px" align="left" nowrap>
   <a href="./e_referencing_files.md">< E) Referencing files</a>
  </td>
  <td width="2000px" align="right" nowrap>
   <a href="./g_jsenv_plugins.md">> G) Jsenv plugins</a>
  </td>
 </tr>
<table>
