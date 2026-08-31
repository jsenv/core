<!-- TITLE: B) Dev -->

<!-- PLACEHOLDER_START:NAV_PREV_NEXT -->

<table>
  <tr>
    <td width="2000px" align="left" nowrap>
      <a href="../a_directory_structure/a_directory_structure.md">&lt; A) Directory Structure</a>
    </td>
    <td width="2000px" align="center" nowrap>
      B) Dev
    </td>
    <td width="2000px" align="right" nowrap>
      <a href="../c_build/c_build.md">&gt; C) Build</a>
    </td>
  </tr>
</table>

<!-- PLACEHOLDER_END -->

This page explains how to use jsenv to start a development server for your source files.

Best parts of the jsenv dev server:

- **Standard web server**: Complies with web standards, ensuring transparency and predictability.
- **Auto-reload on save**: Automatically refreshes the browser when files are saved.
- **Error resilient**: Remains functional even with syntax errors, allowing uninterrupted work.
- **Large browser support**: Serves code compatible with major browsers, including older versions.

<!-- PLACEHOLDER_START:TOC_INLINE -->

# Table of contents

<ol>
  <li>
    <a href="#1-usage">
      Usage
    </a>
      <ul>
        <li>
          <a href="#11-project-file-structure">
            Project file structure
          </a>
        </li>
        <li>
          <a href="#12-starting-the-server">
            Starting the server
          </a>
        </li>
      </ul>
  </li>
  <li>
    <a href="#2-features">
      Features
    </a>
      <ul>
        <li>
          <a href="#21-browser-support">
            Browser support
          </a>
        </li>
        <li>
          <a href="#22-directory-structure-agnostic">
            Directory structure agnostic
          </a>
        </li>
        <li>
          <a href="#23-root-url-equivalence">
            Root url equivalence
          </a>
        </li>
        <li>
          <a href="#24-ribbon">
            ribbon
          </a>
        </li>
        <li>
          <a href="#25-error-overlay">
            Error overlay
          </a>
        </li>
        <li>
          <a href="#26-autoreload">
            Autoreload
          </a>
        </li>
        <li>
          <a href="#27-compatibility-with-frameworks">
            Compatibility with frameworks
          </a>
        </li>
        <li>
          <a href="#28-sourcemaps">
            sourcemaps
          </a>
        </li>
        <li>
          <a href="#29-port">
            port
          </a>
        </li>
        <li>
          <a href="#210-https">
            https
          </a>
        </li>
      </ul>
  </li>
</ol>

<!-- PLACEHOLDER_END -->

# 1. Usage

This section explains how to serve project source files using jsenv.

## 1.1 Project file structure

<pre>
project/
  src/
    index.html
  package.json
</pre>

_src/index.html_:

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
  </body>
</html>
```

Add a `dev.mjs` file:

```diff
project/
+ scripts/
+    dev.mjs
  src/
    index.html
  package.json
```

_scripts/dev.mjs_:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
});
```

## 1.2 Starting the server

a. Install dependencies:

```console
npm i --save-dev @jsenv/core
```

b. Start the server

```console
node ./scripts/dev.mjs
```

Expected output:

```console
✔ start dev server (done in 0.009 second)
- http://localhost:3456
- http://127.0.0.1:3456
```

![Title 2023-05-22 15-49-52](https://github.com/jsenv/core/assets/443639/7db147c2-2529-451b-8459-4d9326014a0c)

_Figure: The development server in action, showing the served files and URLs_

# 2. Features

## 2.1 Browser support

The dev server serves the most compatible version of your code for the browser
being used.

Which runtimes that means is decided exactly as the build decides it — the same
default, the same `browserslist`, the same `runtimeCompat` — so a page cannot
work here and break once built. The list, and how to aim lower or higher, are in
[browser support](../c_build/c_build.md#21-browser-support); the dev server takes
`runtimeCompat` as its own parameter too:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  runtimeCompat: { chrome: "100", firefox: "115", safari: "16.4" },
});
```

**Note**: the browser support after the build process is broader, see [maximal browser support](../c_build/c_build.md#211-maximal-browser-support).

## 2.2 Directory structure agnostic

The dev server is compatible with any directory structure and does not impose assumptions.
However, organizing source files into a dedicated directory is recommended for clarity.

**Not ideal**: Source files are mixed with other files.

```
project/
  node_modules/
    foo/
      foo.js
      package.json
  .gitignore
  index.html
  package.json
```

**Better**: Source files are in a separate directory.

```
project/
  node_modules/
    foo/
      foo.js
      package.json
  src/
    index.html
  .gitignore
  package.json
```

## 2.3 Root url equivalence

The root URL `/` is equivalent to `/index.html`:

<table>
  <tr>
    <th width="50%">
      http://localhost:3456
    </th>
    <th>
      http://localhost:3456/index.html
    </th>
  </tr>
  <tr>
    <td>
      <img alt="title" src="https://github.com/jsenv/core/assets/443639/dc8438c9-5fa6-48be-a9aa-f9a51ddd21fc" />
    </td>
    <td>
      <img alt="title" src="https://github.com/jsenv/core/assets/443639/b96f5db4-1f54-4932-b467-a28b71128988" />
    </td>
  </tr>
</table>

The main file can be configured with `sourceMainFilePath`:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  sourceMainFilePath: "./main.html",
});
```

## 2.4 ribbon

Without a visual marker it's hard to distinguish source files from build files.

| dev server                                                                                 | build server                                                                               |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| ![title](https://github.com/jsenv/core/assets/443639/2b9c81f8-38be-424c-9fd9-6b64b9c061fe) | ![title](https://github.com/jsenv/core/assets/443639/a53b76db-9124-421f-a942-2d01a00d1d27) |

To differentiate source files from build files, the dev server injects a visual marker (ribbon) into HTML files:

![ribbon screenshot](https://github.com/jsenv/core/assets/443639/25e8cd22-2efb-45a4-9d97-84f96ad1b2f7)

_Figure: The ribbon in action, marking the page as served by the dev server_

The code below shows how to disable the ribbon:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  ribbon: false, // Disables the ribbon
});
```

## 2.5 Error overlay

The dev server displays an error overlay when issues occur, complementing the browser’s dev tools:

![image](https://github.com/jsenv/core/assets/443639/3ecd51ac-7851-4201-93dd-30892e23f11c)

_Figure: The error overlay showing an error in the code._

**Example HTML causing an error**:

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
  </body>
</html>
```

Many more examples are available in [the error overlay screenshots directory](../../../tests/dev_server/errors/_dev_errors_snapshots.test.mjs/0_chromium/output/screenshots/).

The error overlay can be disabled as follows:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  supervisor: {
    errorOverlay: false, // Disables the error overlay
  },
});
```

With the overlay disabled, the browser devtools must be opened to see the error:

![image](https://github.com/jsenv/core/assets/443639/f2d9463c-b576-417b-8389-e0650df953f7)

## 2.6 Autoreload

The dev server watches source files and tells the browser to apply changes when a file is saved. There are two ways a change can be applied:

- **Partial reload**: only the files that changed are replaced; the page is not reloaded and its state is preserved.
- **Full reload**: the page is reloaded, as if pressing the reload button.

When a file changes, the dev server looks for a file willing to handle the update: the changed file itself, or one of the files referencing it. Such a file is called a _boundary_. When a boundary is found the update is applied partially; when the search reaches a file with nothing to handle the update, the page is fully reloaded.

### 2.6.1 Partial reload

Files referenced by HTML are partially reloaded according to the element referencing them:

| Element                                        | Applied with   |
| ---------------------------------------------- | -------------- |
| `<link rel="stylesheet">`                      | Partial reload |
| `<link rel="icon">`                            | Partial reload |
| `<img>`, `<source>`, `<image>`, `<use>`, `<a>` | Partial reload |
| `<iframe>`                                     | Partial reload |
| `<script>`                                     | Full reload    |

This is why editing a CSS file updates the page without reloading it: the stylesheet is replaced in place. Each partial reload is logged in the browser console, mentioning the file that was replaced and the change that caused it.

The default can be overridden per element with the `hot-accept` and `hot-decline` attributes:

```html
<!-- Partially reloaded despite being a script -->
<script src="./file.js" hot-accept></script>

<!-- Fully reloaded despite being an image -->
<img src="./image.png" hot-decline />
```

### 2.6.2 Full reload

The page is fully reloaded when the update cannot be handled partially:

- A JavaScript file changed and neither it nor any file importing it calls `import.meta.hot.accept()`
- A file calls `import.meta.hot.decline()`
- The HTML file currently displayed changed
- A file referenced by `<script>` changed, unless it has the `hot-accept` attribute

### 2.6.3 import.meta.hot

`import.meta.hot` lets a JavaScript file handle its own updates, unlocking partial reload for JavaScript.

```js
export const count = 0;

import.meta.hot.accept();
```

`accept()` can be called in several ways:

```js
// Re-execute this file when it changes
import.meta.hot.accept();

// Re-execute this file and receive its new namespace
import.meta.hot.accept((namespace) => {
  console.log(namespace);
});

// Handle updates of a specific dependency
import.meta.hot.accept("./dependency.js", (namespace) => {
  console.log(namespace);
});

// Handle updates of several dependencies
import.meta.hot.accept(["./a.js", "./b.js"], (namespace) => {
  console.log(namespace);
});
```

Use `dispose` to clean up what the file created, such as timers or event listeners; it runs before the file is re-executed. The callback receives `import.meta.hot.data`, an object where values can be stored for that cleanup.

```js
const interval = setInterval(() => {
  console.log("tick");
}, 1000);

import.meta.hot.dispose(() => {
  clearInterval(interval);
});
import.meta.hot.accept();
```

The remaining methods give up on partial reload:

- `import.meta.hot.decline()`: this file can never be partially reloaded, any change fully reloads the page
- `import.meta.hot.invalidate()`: fully reload the page, to be called when the update cannot be handled after all

During build `import.meta.hot` becomes `undefined`, so code kept out of production can be wrapped in a condition:

```js
if (import.meta.hot) {
  import.meta.hot.accept();
}
```

### 2.6.4 Configure autoreload

By default the following files can trigger a reload:

```js
{
  "**/*": true, // All files inside the source directory
  "**/.*": false, // Exclude files starting with a dot
  "**/.*/": false, // Exclude directories starting with a dot
  "**/node_modules/": false, // Exclude node_modules
}
```

The following would change the files being watched:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  sourceFilesConfig: {
    "./**/*.js": true,
    "./**/*.css": false,
  },
});
```

### 2.6.5 Disable autoreload

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  clientAutoreload: false,
});
```

## 2.7 Compatibility with frameworks

Enhance dev server capabilities with plugins. For example, to use React and JSX:

```js
import { startDevServer } from "@jsenv/core";
import { jsenvPluginReact } from "@jsenv/plugin-react";

await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  plugins: [jsenvPluginReact()],
});
```

See the full list of plugins in [G) Plugins](../g_plugins/g_plugins.md)

## 2.8 sourcemaps

The dev server generates source mappings, helping browsers remap compiled code to its original source. The behavior is controlled by the `sourcemaps` parameter:

| Value      | Description                                      |
| ---------- | ------------------------------------------------ |
| `"inline"` | Inline mappings as base64 in sourcemap comments. |
| `"file"`   | Generate separate `.map` files.                  |
| `"none"`   | Disable sourcemap generation.                    |

**Default**: `"inline"`

## 2.9 port

The dev server defaults to port 3456. Change it as needed:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  port: 8888,
});
```

## 2.10 https

The dev server can use HTTPS with a certificate and private key:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  https: {
    certificate: "-----BEGIN CERTIFICATE-----...-----END CERTIFICATE-----",
    privateKey:
      "-----BEGIN RSA PRIVATE KEY-----...'-----END RSA PRIVATE KEY-----",
  },
});
```

**Tip**: Use [@jsenv/https-local](https://github.com/jsenv/https-local)<sup>↗</sup> to generate certificates programmatically.

<!-- PLACEHOLDER_START:NAV_PREV_NEXT -->

<table>
  <tr>
    <td width="2000px" align="left" nowrap>
      <a href="../a_directory_structure/a_directory_structure.md">&lt; A) Directory Structure</a>
    </td>
    <td width="2000px" align="center" nowrap>
      B) Dev
    </td>
    <td width="2000px" align="right" nowrap>
      <a href="../c_build/c_build.md">&gt; C) Build</a>
    </td>
  </tr>
</table>

<!-- PLACEHOLDER_END -->
