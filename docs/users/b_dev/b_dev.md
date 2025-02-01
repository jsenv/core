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
<table>

<!-- PLACEHOLDER_END -->

This page explains how to use jsenv to start a development server for your source files.

Best parts of the jsenv dev server:

- **Standard web server**: Complies with web standards, ensuring transparency and predictability.
- **Auto-reload on save**: Automatically refreshes the browser when files are saved.
- **Error resilient**: Remains functional even with syntax errors, allowing uninterrupted work.
- **Large browser support**: Serves code compatible with majors browsers, including older versions.

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
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
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

# 2. Features

## 2.1 Browser support

The dev server automatically serves the most compatible version of your code for the browser being used.

**Supported browsers during development:**

- Chrome 64+
- Safari 11.3+
- Edge 79+
- Firefox 67+
- Opera 51+
- Safari on IOS 12+
- Samsung Internet 9.2+

**Note**: The browser support after the build process is broader, see [browser support after build](../c_build/c_build.md#211-maximal-browser-support).

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
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
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

The code below shows how to disable the ribbon:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  ribbon: false, // Disables the ribbon
});
```

## 2.5 Error overlay

The dev server displays an error overlay when issues occur, complementing the browser’s dev tools:

![image](https://github.com/jsenv/core/assets/443639/3ecd51ac-7851-4201-93dd-30892e23f11c)

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

A lot of examples are available at [tests/dev_server/errors/screenshots/](../../../tests/dev_server/errors/_dev_errors_snapshots.test.mjs/0_chromium/output/screenshots/).

Error overlay can be disabled as follow:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  supervisor: {
    errorOverlay: false, // Disables the error overlay
  },
});
```

In that case opening the same HTML file does not display error overlay. So devtools must be opened to see the error:

![image](https://github.com/jsenv/core/assets/443639/f2d9463c-b576-417b-8389-e0650df953f7)

## 2.6 Autoreload

The dev server automatically applies changes when files are saved. Some updates can be applied without reloading the page, while others trigger a full reload.

TODO:

- [ ] Explain what is "partial reload" + when it can be used (css for instance)
- [ ] screenshots
- [ ] explain `import.meta.hot` to unlock partial reload on js
- [ ] Explain what is "full reload" + when it is used
- [ ] screenshots

### 2.6.1 Configure autoreload

By default the following files can trigger a reload:

```js
{
  "**/*": true, // All files inside the source directory
  "**/.*/": false, // Exclude directory starting with a dot
  "**/node_modules/": false, // Exclude node_modules
}
```

The following would change the files being watched:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  sourceFilesConfig: {
    "./**/*.js": true,
    "./**/*.css": false,
  },
});
```

### 2.6.2 Disable autoreload

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  clientAutoreload: false,
});
```

## 2.7 Compatibility with frameworks

Enhance dev server capabilities with plugins. For example, to use React and JSX:

```js
import { startDevServer } from "@jsenv/core";
import { jsenvPluginReact } from "@jsenv/plugin-react";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  plugins: [jsenvPluginReact()],
});
```

See the full list of plugins in [G) Plugins](../g_plugins/g_plugins.md)

## 2.8 sourcemaps

The dev server generates source mappings, helping browsers remap compiled code to its original source.

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
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  port: 8888,
});
```

## 2.10 https

The dev server can use HTTPS with a certificate and private key:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
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
<table>

<!-- PLACEHOLDER_END -->
