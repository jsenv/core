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

This page documents how jsenv can be used to start a server for source files.

Best parts of jsenv dev server:

- Standard web server; no hidden constraints or behavior deviating from standards.
- Autoreload on save; instruct browser to autoreload when a file is saved.
- Error resilient; everything still works when you do a syntax error for instance.
- Large [browser support](#21-browser-support); code served is compatible with main browsers of the market, even old versions.

<!-- PLACEHOLDER_START:TOC -->

<details>
  <summary>Table of contents</summary>
  <ul>
    <li>
      <a href="#1-usage">
        1. Usage
      </a>
        <ul>
          <li>
            <a href="#11-project-file-structure">
              1.1 Project file structure
            </a>
          </li>
          <li>
            <a href="#12-starting-the-server">
              1.2 Starting the server
            </a>
          </li>
        </ul>
    </li>
    <li>
      <a href="#2-features">
        2. Features
      </a>
        <ul>
          <li>
            <a href="#21-browser-support">
              2.1 Browser support
            </a>
          </li>
          <li>
            <a href="#22-directory-structure-agnostic">
              2.2 Directory structure agnostic
            </a>
          </li>
          <li>
            <a href="#23-root-url-equivalence">
              2.3 Root url equivalence
            </a>
          </li>
          <li>
            <a href="#24-ribbon">
              2.4 ribbon
            </a>
          </li>
          <li>
            <a href="#25-error-overlay">
              2.5 Error overlay
            </a>
          </li>
          <li>
            <a href="#26-autoreload">
              2.6 Autoreload
            </a>
          </li>
          <li>
            <a href="#27-compatibility-with-frameworks">
              2.7 Compatibility with frameworks
            </a>
          </li>
          <li>
            <a href="#28-sourcemaps">
              2.8 sourcemaps
            </a>
          </li>
          <li>
            <a href="#29-port">
              2.9 port
            </a>
          </li>
          <li>
            <a href="#210-https">
              2.10 https
            </a>
          </li>
        </ul>
    </li>
  </ul>
</details>

<!-- PLACEHOLDER_END -->

# 1. Usage

This section shows how to serve a project source files using jsenv.

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

Adding the dev server have the following impacts on the file structure:

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

Before starting the server, install dependencies with the following command:

```console
npm i --save-dev @jsenv/core
```

Everything is ready, server can be started with the following command:

```console
node ./scripts/dev.mjs
```

It will display the following output in the terminal:

```console
✔ start dev server (done in 0.009 second)
- http://localhost:3456
- http://127.0.0.1:3456
```

![Title 2023-05-22 15-49-52](https://github.com/jsenv/core/assets/443639/7db147c2-2529-451b-8459-4d9326014a0c)

# 2. Features

## 2.1 Browser support

Dev server support a large set of browsers:

- Chrome 64+
- Safari 11.3+
- Edge 79+
- Firefox 67+
- Opera 51+
- Safari on IOS 12+
- Samsung Internet 9.2+

This is the list of browsers that can be used during dev. The browser support [after build](../c_build/Build#211-maximal-browser-support) is larger.

## 2.2 Directory structure agnostic

The dev server is compatible with _any_ directory structure, it does not assume anything.
However it's recommended to have a directory dedicated to source files.

**Not ideal**: source files are mixed with other files

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

**Better**: source files have their own directory

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

`/` is equivalent to `/index.html` as shown by the following screenshots:

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

The file can be configured with `sourceMainFilePath`:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  sourceMainFilePath: "./main.html",
});
```

## 2.4 ribbon

When a project has a server for build files it becomes hard to tell if a browser is displaying source files or build files.

To differentiate them, one have to:

1. look at the url
2. check the port
3. know which port belongs to which server

| dev server                                                                                 | build server                                                                               |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| ![title](https://github.com/jsenv/core/assets/443639/2b9c81f8-38be-424c-9fd9-6b64b9c061fe) | ![title](https://github.com/jsenv/core/assets/443639/a53b76db-9124-421f-a942-2d01a00d1d27) |

To avoid potential confusion jsenv dev server is injecting a visual marker into HTML files:

![ribbon screenshot](https://github.com/jsenv/core/assets/443639/25e8cd22-2efb-45a4-9d97-84f96ad1b2f7)

The code below shows how to disable this feature:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  ribbon: false,
});
```

## 2.5 Error overlay

The error overlay is a visual element displayed when there is an error:

![image](https://github.com/jsenv/core/assets/443639/3ecd51ac-7851-4201-93dd-30892e23f11c)

It complements error(s) displayed in browser devtools.
Error overlay exists because lots of errors occur during dev and it is handy to have a feedback without having to open browser devtools.

The following HTML was used to produce the error (it tries to load _main.js_ but the file does not exists):

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

Check [tests/dev_server/errors/screenshots/](../../../tests/dev_server/errors/snapshots/sceenshots/) for more examples.

Error overlay can be disabled as follow:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  supervisor: {
    errorOverlay: false,
  },
});
```

In that case opening the same HTML file does not display error overlay. So devtools must be opened to see the error:

![image](https://github.com/jsenv/core/assets/443639/f2d9463c-b576-417b-8389-e0650df953f7)

## 2.6 Autoreload

When a file is saved jsenv apply changes in all browser connected to the dev server.  
Some changes can be applied without reloading the page, others will reload the page.

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
  "**/*": true, // everything inside the source directory
  "**/.*/": false, // except directory starting with a dot
  "**/node_modules/": false, // and except node_modules directory
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

Dev server capabilities can be enhanced using `plugins`.  
The following code would allow to use react and jsx in source files:

```js
import { startDevServer } from "@jsenv/core";
import { jsenvPluginReact } from "@jsenv/plugin-react";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  plugins: [jsenvPluginReact()],
});
```

See the list of plugins in [G) Plugins](../g_plugins/g_plugins.md)

## 2.8 sourcemaps

Dev server generates source mappings and puts a comment into the generated files to let browser remap to original file contents. This behaviour can be configured with `sourcemaps` using one of the following values:

| Value      | Description                                                                    |
| ---------- | ------------------------------------------------------------------------------ |
| `"inline"` | Generate source mappings and inline them as base64 into a sourcemap comment    |
| `"file"`   | Generate separate files for source mappings with comment pointing on that file |
| `"none"`   | Source mappings are not generated; also disables sourcemap comment injection   |

The default value is `"inline"`

## 2.9 port

The default port listened is `3456`. It can be configured as shown below:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  port: 8888,
});
```

## 2.10 https

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

☝️ The code above does not show the real value for `certificate` and `privateKey`. Usually these value are read from files generated by ssl commands. It's also possible to use [@jsenv/https-local](https://github.com/jsenv/https-local)<sup>↗</sup> to generate certificate and privateKey programmatically.

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
