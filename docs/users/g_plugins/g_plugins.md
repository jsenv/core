<!-- TITLE: G) Plugins -->

<!-- PLACEHOLDER_START:NAV_PREV_NEXT -->

<table>
  <tr>
    <td width="2000px" align="left" nowrap>
      <a href="../f_features/f_features.md">&lt; F) Features</a>
    </td>
    <td width="2000px" align="center" nowrap>
      G) Plugins
    </td>
    <td width="2000px" align="right" nowrap>
      <a href="../h_going_further/h_going_further.md">&gt; H) Going further</a>
    </td>
  </tr>
<table>

<!-- PLACEHOLDER_END -->

# Introduction to plugins

Plugins in jsenv provide a powerful and flexible way to extend its standard functionality. By default, jsenv offers a "standard" behavior suitable for common use cases. However, every project has unique needs, and that’s where plugins come in.

Plugins enable additional capabilities or integrations with external tools like popular frameworks such as React or Preact. They can also introduce non-standard features to address specific requirements.

In short, plugins make jsenv a highly adaptable tool, seamlessly fitting into diverse environments and workflows. This document outlines the available plugins, their usage, and the possibilities they unlock for your projects.

<!-- PLACEHOLDER_START:TOC_INLINE -->

# Table of contents

<ol>
  <li>
    <a href="#1-how-to-add-a-plugin">
      How to add a plugin
    </a>
  </li>
  <li>
    <a href="#2-transversal-plugins">
      Transversal plugins
    </a>
      <ul>
        <li>
          <a href="#react">
            React
          </a>
        </li>
        <li>
          <a href="#commonjs">
            CommonJs
          </a>
        </li>
        <li>
          <a href="#asjsclassic">
            asJsClassic
          </a>
        </li>
      </ul>
  </li>
  <li>
    <a href="#preact">
      Preact
    </a>
  </li>
  <li>
    <a href="#3-dev-plugins">
      Dev plugins
    </a>
      <ul>
        <li>
          <a href="#31-explorer">
            explorer
          </a>
        </li>
        <li>
          <a href="#32-toolbar">
            toolbar
          </a>
        </li>
      </ul>
  </li>
</ol>

<!-- PLACEHOLDER_END -->

# 1. How to add a plugin

Adding a plugin is as simple as importing it and including it in your `plugins` array when calling jsenv functions.

**Example**

Here's a sample code demonstrating usage of multiple plugins:

```js
import { startDevServer } from "@jsenv/core";
import { jsenvPluginReact } from "@jsenv/plugin-react";
import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";

await startDevServer({
  plugins: [jsenvPluginReact(), jsenvPluginAsJsClassic()],
});
```

# 2. Transversal plugins

Transversal plugins enhance jsenv's fundamental capabilities. These plugins provides support for specific features or frameworks.

## React

- **Purpose**: Adds compatibility with React JSX.
- **Usage**:

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

  ```js
  import { build } from "@jsenv/core";
  import { jsenvPluginReact } from "@jsenv/plugin-react";

  await build({
    plugins: [jsenvPluginReact()],
  });
  ```

## CommonJs

- **Purpose**: You want to import code written in CommonJS. This plugin transform file content written in CommonJs into js modules that can be imported.
- **Example**:

  ```diff
  - require("./file.js");
  - module.exports.answer = 42;
  - console.log(process.env.NODE_ENV);

  + import "./file.js";
  + export const answer = 42;
  + console.log("development"); // would be "production" after build
  ```

- **Usage**:

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

## asJsClassic

- **Purpose**: You want the power of js modules (import, dynamic import, import.meta, ...) but js MUST still be executed by a classic `<script>` for technical reasons.

- **Example**: The following HTML file uses a script to load a js file:

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

  This plugin transform file content when `?as_js_classic` query parameter is present. It could transforms a theorical `main.js` file content as follow:

  ```diff
  - import { foo } from "./foo.js";
  - console.log(import.meta.url);
  - console.log(foo);

  + const foo = 42;
  + console.log(document.currentScript.src);
  + console.log(foo);
  ```

- **Usage**:

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

  ```js
  import { build } from "@jsenv/core";
  import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";

  await build({
    plugins: [jsenvPluginAsJsClassic()],
  });
  ```

# Preact

- **Purpose**: Adds compatibility with React JSX but using preact instead of react
- **Usage**:

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

  ```js
  import { build } from "@jsenv/core";
  import { jsenvPluginPreact } from "@jsenv/plugin-preact";

  await build({
    plugins: [jsenvPluginPreact()],
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

# Conclusion

Plugins are the key to unlocking jsenv’s full potential. Whether you need compatibility with a specific framework or advanced project-level capabilities, plugins ensure jsenv adapts seamlessly to your needs. Explore the available plugins and experiment with their configurations to customize your workflow.

<!-- PLACEHOLDER_START:NAV_PREV_NEXT -->

<table>
  <tr>
    <td width="2000px" align="left" nowrap>
      <a href="../f_features/f_features.md">&lt; F) Features</a>
    </td>
    <td width="2000px" align="center" nowrap>
      G) Plugins
    </td>
    <td width="2000px" align="right" nowrap>
      <a href="../h_going_further/h_going_further.md">&gt; H) Going further</a>
    </td>
  </tr>
<table>

<!-- PLACEHOLDER_END -->
