<!-- TITLE: F) Features -->

<!-- PLACEHOLDER_START:NAV_PREV_NEXT -->

<table>
  <tr>
    <td width="2000px" align="left" nowrap>
      <a href="../e_referencing_files/e_referencing_files.md">&lt; E) Referencing files</a>
    </td>
    <td width="2000px" align="center" nowrap>
      F) Features
    </td>
    <td width="2000px" align="right" nowrap>
      <a href="../g_plugins/g_plugins.md">&gt; G) Plugins</a>
    </td>
  </tr>
</table>

<!-- PLACEHOLDER_END -->

This page outlines the key features provided by Jsenv, including Node ESM resolution, magic extensions, `import.meta.dev`, injections, inlining, and handling UMD/CommonJS modules.

<!-- PLACEHOLDER_START:TOC_INLINE -->

# Table of contents

<ol>
  <li>
    <a href="#1-node-esm-resolution">
      Node ESM resolution
    </a>
      <ul>
        <li>
          <a href="#11-node-module-files-during-dev">
            Node module files during dev
          </a>
        </li>
      </ul>
  </li>
  <li>
    <a href="#2-magic-extensions">
      Magic extensions
    </a>
  </li>
  <li>
    <a href="#3-importmetadev">
      import.meta.dev
    </a>
  </li>
  <li>
    <a href="#4-injections">
      Injections
    </a>
  </li>
  <li>
    <a href="#5-inlining">
      Inlining
    </a>
  </li>
  <li>
    <a href="#6-importing-umd">
      Importing UMD
    </a>
  </li>
  <li>
    <a href="#7-importing-commonjs">
      Importing CommonJs
    </a>
  </li>
  <li>
    <a href="#8-loading-js-module-with">
      Loading js module with 
    </a>
  </li>
</ol>

<!-- PLACEHOLDER_END -->

# 1. Node ESM resolution

Jsenv implements Node.js ESM resolution for JavaScript imports, enabling compatibility with Node.js module resolution in the browser.

**Example:**

```js
import "amazing-package";
```

This is transformed into:

```js
import "/node_modules/amazing-package/index.js";
```

See some of the features provided by Node ESM resolution:

- [Self referencing a package using its name](https://nodejs.org/docs/latest-v18.x/api/packages.html#self-referencing-a-package-using-its-name)<sup>↗</sup>
- [Subpath exports](https://nodejs.org/docs/latest-v18.x/api/packages.html#subpath-exports)<sup>↗</sup>
- [Subpath imports](https://nodejs.org/docs/latest-v18.x/api/packages.html#subpath-imports)<sup>↗</sup>

## 1.1 Node module files during dev

During development, imports from `node_modules` are versioned using the package's version field from `package.json`.

**Example:**

```js
import "/node_modules/amazing-package/index.js?v=1.0.0";
```

☝️ Here _amazing-package/package.json_ contains `"version": "1.0.0"`

It allows to put node modules files into the browser cache up to **1 year**.  
A nice bonus: the version of the package is easily identifiable.

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
> Magic extensions are becoming less common in the JavaScript ecosystem. Avoid using them when possible.

Jsenv supports magic extensions for resolving file imports without explicit extensions.

**Example:**

```js
import "./file";
```

This is resolved to:

```js
import "./file.js";
```

Disabling Magic Extensions:

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

Use `import.meta.dev` to differentiate behavior between development and production builds.
Code specific to development is removed during the build process.

**Example:**

```js
if (import.meta.dev) {
  console.log("during dev"); // logged when executing source files
} else {
  console.log("after build"); // logged when executing files after build
}
```

# 4. Injections

Jsenv allows injecting variables into file content during development and build.

**Example:**

```js
// eslint-disable-next-line no-undef
window.__ENV__ = __ENV__;
console.log(window.__ENV__);
```

**Development configuration:**

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  injections: {
    "./main.js": () => {
      return { __ENV__: "dev" };
    },
  },
});
```

The browser will see the following file content:

```diff
// eslint-disable-next-line no-undef
+ window.__ENV__ = "dev";
console.log(window.__ENV__);
```

**Build configuration:**

```js
import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: { "./main.html": "main.html" },
  injections: {
    "./main.js": () => {
      return { __ENV__: "build" };
    },
  },
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

Inlining allows embedding code from separate files directly into HTML or other files.

**Example:**

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

This inlines `demo.js` into the HTML:

```html
<script>
  console.log("Hello world");
</script>
```

# 6. Importing UMD

UMD (Universal Module Definition) modules can be imported directly. For packages like `jquery`:

**Example:**

```js
import "jquery";

const jquery = window.$;
```

For packages like `hls.js` that require this to be defined, use the as_js_module query parameter:

**Example:**

```js
import "hls.js?as_js_module";

window.Hls;
```

# 7. Importing CommonJs

CommonJS modules are not natively supported in browsers.

**Example:**

```js
// main.js
module.exports = 42;
```

**Error:**

```console
Uncaught ReferenceError: module is not defined
```

**Solution**: Use `jsenvPluginCommonJs` documented in [G) Plugins#commonjs](../g_plugins/g_plugins.md#21-commonjs).

# 8. Loading js module with `<script>`

To load a JavaScript module with a classic `<script>` tag while retaining module features use `jsenvPluginAsJsClassic`.

**Example**:

```html
<script src="file.js"></script>
```

```js
// file.js
console.log(import.meta.url);
```

**Error:**

```console
Uncaught SyntaxError: Cannot use import statement outside a module
```

**Solution:** Use `jsenvPluginAsJsClassic` documented in [G) Plugins#asJsClassic](../g_plugins/g_plugins.md#22-asjsclassic).

<!-- PLACEHOLDER_START:NAV_PREV_NEXT -->

<table>
  <tr>
    <td width="2000px" align="left" nowrap>
      <a href="../e_referencing_files/e_referencing_files.md">&lt; E) Referencing files</a>
    </td>
    <td width="2000px" align="center" nowrap>
      F) Features
    </td>
    <td width="2000px" align="right" nowrap>
      <a href="../g_plugins/g_plugins.md">&gt; G) Plugins</a>
    </td>
  </tr>
</table>

<!-- PLACEHOLDER_END -->
