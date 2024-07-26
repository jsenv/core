# G) Plugins

Official jsenv plugins written and maintained by jsenv.

<!-- PLACEHOLDER_START:TABLE_OF_CONTENT -->

<details open>
  <summary>G) Plugins</summary>
  <ul>    
    <li>
      <a href="#1-dev-build-transversal">
        1. Dev, build, transversal
      </a>
    </li>    
    <li>
      <a href="#2-transversal-plugins">
        2. Transversal plugins
      </a>
    </li>    
    <li>
      <a href="#3-dev-plugins">
        3. Dev plugins
      </a>
    </li>    
    <li>
      <a href="#4-build-plugins">
        4. Build plugins
      </a>
    </li>
  </ul>
</details>

<!-- PLACEHOLDER_END -->

# 1. Dev, build, transversal

A plugin is either:

- transversal: must be passed both to `startDevServer` and `build`.
- dev only: must be passed to `startDevServer`; Passing it to `build` have no effect.
- build only: must be passed to `build`; Passing it to `startDevServer` have no effect.

Plugins are enabled during dev as follows:

```js
import { startDevServer } from "@jsenv/core";
import { myJsenvPlugin } from "./my_jsenv_plugin.js";

await startDevServer({
  plugins: [myJsenvPlugin()],
});
```

Plugins are enabled during build as follows:

```js
import { build } from "@jsenv/core";
import { myJsenvPlugin } from "./my_jsenv_plugin.js";

await build({
  plugins: [myJsenvPlugin()],
});
```

See [2. Transversal plugins](#2-transversal-plugins), [3. Dev plugins](#3-dev-plugins), [4. Build plugins](#4-build-plugins).

# 2. Transversal plugins

## 2.1 commonjs

Use this plugin if:

1. you want to import code written in commonJS format

This plugin transforms file content written in commonjs into js modules so it can be imported:

```diff
- require("./file.js");
- module.exports.answer = 42;
- console.log(process.env.NODE_ENV);

+ import "./file.js";
+ export const answer = 42;
+ console.log("development"); // would be "production" after build
```

**Installation and configuration**

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

Usually it's a package (a node module) that is written in commonjs format.
In that case configure `include` like this:

```js
jsenvPluginCommonJs({
  include: {
    "file:///**/node_modules/react/": true,
  },
});
```

## 2.2 asJsClassic

Use this plugin if:

1. your js must be executed by a classic `<script>` and not by `<script type="module">`
2. you still want the power of js modules (import, dynamic import, import.meta, ...)

Conversion happens when a reference to a file uses "as_js_classic" query parameter:

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

Content of _main.js_ is transformed to be executable by a regular `<script>`:

```diff
- import { foo } from "./foo.js";
- console.log(import.meta.url);
- console.log(foo);

+ const foo = 42;
+ console.log(document.currentScript.src);
+ console.log(foo);
```

**Installation and configuration**

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

## 2.3 preact

1. Transpile jsx in some files (".jsx" and ".tsx")
2. Inject `import { jsxDEV } from "preact-jsx-runtime";` in jsx files during dev
3. Inject `import { jsx } from "preact-jsx-runtime";` in jsx files during build
4. Inject `import.meta.hot` in jsx files (enable partial reload/HMR)
5. Inject preact devtools during dev
6. Inject name on preact hooks for preact devtools

**Installation and configuration**

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

## 2.4 react

1. Transpile jsx in some files (".jsx" and ".tsx")
2. Inject `import { jsx } from "react/jsx-dev-runtime";` in jsx files during dev
3. Inject `import { jsx } from "react/jsx-runtime";` in jsx files during build
4. Inject `import.meta.hot` in jsx files (enable partial reload/HMR)
5. Transpiles react packages from commonjs to js modules

**Installation and configuration**

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

# 3. Dev plugins

## 3.1 explorer

This plugin adds a new behaviour on dev server: the root url displays an HTML page listing a subset of files from the source directory:

![screenshot explorer.html](https://github.com/jsenv/core/assets/443639/4efd2fb9-4108-4413-86d0-3300a56e49d8)

It is very useful when a project contains multiple HTML files.

**Installation and configuration**

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

Your main HTML file can be opened by visiting the exact url, like `http://localhost:3456/index.html`:

![Title 2023-05-11 09-10-47](https://github.com/jsenv/core/assets/443639/8af16b6c-7641-4b63-9e15-fbcb42dc59c2)

It's possible to keep `http://localhost:3456` equivalent to `http://localhost:3456/index.html` by configuring a `pathname` where explorer should be served:

```js
import { startDevServer } from "@jsenv/core";
import { jsenvPluginExplorer } from "@jsenv/plugin-explorer";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  plugins: [
    jsenvPluginExplorer({
      pathname: "/explore",
    }),
  ],
});
```

And it's possible to configure the group of files as follow:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  plugins: [
    jsenvPluginExplorer({
      pathname: "/explore",
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

## 3.2 toolbar

Inject a toolbar in html files.
This toolbar display various info and can configure jsenv behaviour during dev; for instance to disable autoreload on change for a moment.

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
| Index button        | Link to the explorer/index page                    |
| Execution indicator | Displays state of this HTML page execution         |
| Server indicator    | Displays state of connection with jsenv dev server |
| Settings button     | Button to open toolbar settings                    |
| Close button        | Button to close the toolbar                        |

**Installation and configuration**

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

# 4. Build plugins

There is no plugin specific to build for now.

<!-- PLACEHOLDER_START:PREV_NEXT_NAV -->

<table>
 <tr>
  <td width="2000px" align="left" nowrap>
   <a href="../f_features/f_features.md">&lt; F) Features</a>
  </td>
  <td width="2000px" align="right" nowrap>
   <a href="../h_going_further/h_going_further.md">&gt; H) Going further</a>
  </td>
 </tr>
<table>

<!-- PLACEHOLDER_END -->
