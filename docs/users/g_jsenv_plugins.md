# G) Jsenv plugins

Official plugins written and maintained by jsenv.

# 1. Dev, build, transversal

Plugins are enabled during dev as follows:

```js
import { startDevServer } from "@jsenv/core";
import { myJsenvPlugin } from "./my_jsenv_plugin.js";

await startDevServer({
  plugins: [myJsenvPlugin()],
});
```

Plugins are enabled on build as follows:

```js
import { build } from "@jsenv/core";
import { myJsenvPlugin } from "./my_jsenv_plugin.js";

await build({
  plugins: [myJsenvPlugin()],
});
```

A plugin is either:

- dev only: must be passed to `startDevServer`; Passing it to `build` have no effect.
- build only: must be passed to `build`; Passing it to `startDevServer` have no effect.
- transversal: must be passed both to `startDevServer` and `build`.

See [2. Dev plugins](#2-dev-plugins), [3. Build plugins](#3-build-plugins) and [4. Transversal plugins](#4-transversal-plugins).

# 2. Dev plugins

## 2.1 explorer

Explorer adds a new behaviour on dev server root url. It will show an HTML page listing a subset of files from the source directory.  
It is very useful when a project contains multiple HTML files.

```console
npm i --save-dev @jsenv/plugin-explorer
```

```js
import { startDevServer } from "@jsenv/core";
import { jsenvPluginExplorer } from "@jsenv/plugin-explorer";

await startDevServer({
  plugins: [jsenvPluginExplorer()],
});
```

Screenshot after opening `http://localhost:3456`:

![screenshot explorer.html](https://github.com/jsenv/core/assets/443639/4efd2fb9-4108-4413-86d0-3300a56e49d8)

Your main HTML file can be opened by visiting the exact url, like `http://localhost:3456/index.html`:

![Title 2023-05-11 09-10-47](https://github.com/jsenv/core/assets/443639/8af16b6c-7641-4b63-9e15-fbcb42dc59c2)

It's possible to keep `http://localhost:3456` equivalent to `http://localhost:3456/index.html` by configuring a `pathname` where explorer should be served:

```js
import { startDevServer } from "@jsenv/core";
import { jsenvPluginExplorer } from "@jsenv/plugin-explorer";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  plugins: [jsenvPluginExplorer({ pathname: "/explore" })],
});
```

And it's possible to configure the group of files as follow:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  plugins: [
    jsenvPluginExplorer({
      groups: {
        "main files": {
          "./**/*.html": true,
          "./**/*.test.html": false,
        },
        "spec files": {
          "./**/*.test.html": true,
        },
      },
    }),
  ],
});
```

The page now displays "main files" and "spec files":

![Exploring 2023-05-22 16-02-14](https://github.com/jsenv/core/assets/443639/b9d4c7d1-5db7-4cc5-b1b9-fcb3e138b7bb)

## 2.2 toolbar

Inject a toolbar in html files.
This toolbar display various info and can configure jsenv behaviour during dev; for instance to disable autoreload on change for a moment.

```console
npm i --save-dev @jsenv/plugin-toolbar
```

```js
import { startDevServer } from "@jsenv/core";
import { jsenvPluginToolbar } from "@jsenv/plugin-toolbar";

await startDevServer({
  plugins: [jsenvPluginToolbar()],
});
```

By default the toolbar is hidden, there is a discrete way to open it at the bottom right of the page.

![Title 2022-12-12 09-42-28](https://user-images.githubusercontent.com/443639/207000431-4948938b-a434-4a19-b80d-af918610382a.png)

When hovering this area, a small strip is displayed

![Title 2022-12-12 09-45-19](https://user-images.githubusercontent.com/443639/207000795-afa7cb84-5e7c-45ae-99e4-8150001db95e.png)

It can be clicked to open the toolbar

![Title 2022-12-12 09-46-14](https://user-images.githubusercontent.com/443639/207001058-3a04a103-8eaf-44ef-bd06-22b4621547dc.png)

The toolbar is composed as follows:

![Title 2022-12-13 14-03-55](https://user-images.githubusercontent.com/443639/207327042-433329a6-3008-44f1-9b36-d976d574be3d.png)

| Component           | Description                                        |
| ------------------- | -------------------------------------------------- |
| Index button        | Link to the index page                             |
| Execution indicator | Displays state of this HTML page execution         |
| Server indicator    | Displays state of connection with jsenv dev server |
| Settings button     | Button to open toolbar settings                    |
| Close button        | Button to close the toolbar                        |

# 3. Build plugins

## 3.1 bundling

Bundling drastically reduces the number of files after build by concatenating file contents.
This plugin enables bundling on the following file types:

| File type | bundler used under the hood                                                 |
| --------- | --------------------------------------------------------------------------- |
| js module | [rollup](https://github.com/rollup/rollup)<sup>↗</sup>                     |
| css       | [lightningcss](https://github.com/parcel-bundler/lightningcss)<sup>↗</sup> |

```console
npm i --save-dev @jsenv/plugin-bundling
```

```js
import { build } from "@jsenv/core";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

const buildResult = await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
  plugins: [jsenvPluginBundling()],
});
```

Use an object to configure what is bundled:

```js
jsenvPluginBundling({
  js_module: false,
  css: true,
});
```

### 3.1.1 Js module chunks

`chunks` parameter can be used to assign source files to build files. The code below puts the content of node module files and _a.js_ inside _vendors.js_:

```js
jsenvPluginBundling({
  js_module: {
    chunks: {
      vendors: {
        "file:///**/node_modules/": true,
        "./a.js": true,
      },
    },
  },
});
```

The source files not assigned by `chunks` are distributed optimally into build files.

## 3.2 minification

Minification decreases file size.
This plugin enables minification during build on the following file types:

| File type                | Minifier used under the hood                                                |
| ------------------------ | --------------------------------------------------------------------------- |
| js module and js classic | [terser](https://github.com/terser/terser)<sup>↗</sup>                     |
| html and svg             | [html-minifier](https://github.com/kangax/html-minifier)<sup>↗</sup>       |
| css                      | [lightningcss](https://github.com/parcel-bundler/lightningcss)<sup>↗</sup> |
| json                     | White spaces are removed using JSON.stringify                               |

```console
npm i --save-dev @jsenv/plugin-minification
```

```js
import { build } from "@jsenv/core";
import { jsenvPluginMinification } from "@jsenv/plugin-minification";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
  plugins: [jsenvPluginMinification()],
});
```

Use an object to configure what is minified:

```js
jsenvPluginMinification({
  html: false,
  css: true,
  js_classic: true,
  js_module: true,
  json: false,
  svg: false,
});
```

# 4. Transversal plugins

## 4.1 globals

Inject JS globals into HTML or JS file contents.

```console
npm i --save-dev @jsenv/plugin-globals
```

```js
import { startDevServer } from "@jsenv/core";
import { jsenvPluginGlobals } from "@jsenv/plugin-globals";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  plugins: [
    jsenvPluginGlobals({
      "./main.js": (urlInfo, context) => {
        return { __ENV__: context.dev ? "dev" : "build" };
      },
    }),
  ],
});
```

Assuming `"main.js"` content is the following:

```js
console.log(window.__ENV__);
```

The plugin would transform file content as follows:

```diff
+ window.__ENV__ = "dev";
console.log(window.__ENV__);
```

It's also possible to inject variables into an HTML file.
In that case a `<script>` tag is injected into `<head>` as follows:

```html
<script>
  window.__ENV__ = "dev";
</script>
```

## 4.2 placeholders

Replace placeholders declared in file contents.

```console
npm i --save-dev @jsenv/plugin-placeholders
```

```js
import { startDevServer } from "@jsenv/core";
import { jsenvPluginPlaceholders } from "@jsenv/plugin-placeholders";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  plugins: [
    jsenvPluginPlaceholders({
      "./main.js": (urlInfo, context) => {
        return { __ENV__: context.dev ? "dev" : "build" };
      },
    }),
  ],
});
```

Assuming `"main.js"` content is the following:

```js
console.log(__ENV__);
```

The plugin would transform file content as follows:

```diff
- console.log(__ENV__);
+ console.log("dev");
```

## 4.3 commonjs

Transform file content written in commonjs into js modules.

```console
npm i --save-dev @jsenv/plugin-commonjs
```

```js
import { startDevServer } from "@jsenv/core";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";

await startDevServer({
  plugins: [
    jsenvPluginCommonJs({
      include: {
        "./main.js": true,
      },
    }),
  ],
});
```

Example of code converted from commonjs to js module:

```diff
- require("./file.js");
- module.exports.answer = 42;
- console.log(process.env.NODE_ENV);

+ import("./file.js");
+ export const answer = 42;
+ console.log("development"); // would be "production" after build
```

Usually it's a package (a node module) that is written in commonjs format.
In that case configure `include` like this:

```js
jsenvPluginCommonJs({
  include: {
    "file:///**/node_modules/react/": true,
  },
});
```

## 4.4 asJsClassic

Transform file content written in js modules into js classic.

```console
npm i --save-dev @jsenv/plugin-as-js-classic
```

```js
import { startDevServer } from "@jsenv/core";
import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";

await startDevServer({
  plugins: [jsenvPluginAsJsClassic()],
});
```

Example of code converted from js module to js classic:

```diff
- import { foo } from "./foo.js";
- console.log(import.meta.url);
- console.log(foo);

+ const foo = 42;
+ console.log(document.currentScript.src);
+ console.log(foo);
```

☝️ The content of "./foo.js" was `export const foo = 42;`

Conversion happens when a reference to a file uses "as*js_classic" query parameter.
The example below enable conversion to js classic on \_main.js*:

```html
<!doctype html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
  </head>

  <body>
    <script src="./main.js?as_js_classic"></script>
  </body>
</html>
```

## 4.5 preact

```console
npm i --save-dev @jsenv/plugin-preact
```

```js
import { startDevServer } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

await startDevServer({
  plugins: [jsenvPluginPreact()],
});
```

1. Transpile jsx in some files (".jsx" and ".tsx")
2. Inject `import { jsxDEV } from "preact-jsx-runtime";` in jsx files during dev
3. Inject `import { jsx } from "preact-jsx-runtime";` in jsx files during build
4. Inject `import.meta.hot` in jsx files (enable partial reload/HMR)
5. Inject preact devtools during dev
6. Inject name on preact hooks for preact devtools

## 3.6 react

```console
npm i --save-dev @jsenv/plugin-react
```

```js
import { startDevServer } from "@jsenv/core";
import { jsenvPluginReact } from "@jsenv/plugin-react";

await startDevServer({
  plugins: [jsenvPluginReact()],
});
```

1. Transpile jsx in some files (".jsx" and ".tsx")
2. Inject `import { jsx } from "react/jsx-dev-runtime";` in jsx files during dev
3. Inject `import { jsx } from "react/jsx-runtime";` in jsx files during build
4. Inject `import.meta.hot` in jsx files (enable partial reload/HMR)
5. Transpiles react packages from commonjs to js modules

<table>
 <tr>
  <td width="2000px" align="left" nowrap>
   <a href="./f_features.md">< F) Features</a>
  </td>
  <td width="2000px" align="right" nowrap>
   <a href="H)-Jsenv-plugin-API">> H) Jsenv plugin API</a>
  </td>
 </tr>
<table>
