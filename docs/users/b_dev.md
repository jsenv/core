# B) Dev

This page documents how jsenv can be used to start a server for source files.  
This server is meant to be used locally, on your machine.

Best parts of jsenv dev server:

- Support any directory structure, allowing to put **all** source files into their own directory
- Can serve any number of html files, you are not limited to a single _index.html_.
- The code served is compatible with main browsers of the market, even old versions
- Instruct browser to autoreload when a file is saved, with support for hot reloading

# 1. How to start dev server

The dev server will be added to a project with the following file structure:

<pre>
project/
  src/
    index.html
  package.json
</pre>

Adding the dev server have the following impacts on that file structure:

```diff
project/
+ scripts/
+    dev.mjs
  src/
    index.html
  package.json
```

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

_scripts/dev.mjs_:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
});
```

Before starting dev server, install dependencies with the following command:

```console
npm i --save-dev @jsenv/core
```

Everything is ready, dev server can be started with the following command:

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

## 2.1 Directory structure agnostic

The dev server is compatible with _any_ directory structure, it does not assume anything.
However it's recommended to have a directory dedicated to source files.

**Not ideal**: source files are mixed with other files

```
project/
  index.html
  package.json
```

**Better**: source files have their own directory

```
project/
  src/
    index.html
  package.json
```

## 2.2 Root url equivalence

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
      <img alt="title" src="./dev_root_url.png" />
    </td>
    <td>
      <img alt="title" src="./dev_root_url_2.png" />
    </td>
  </tr>
</table>

The file served at `/` can be configured with `sourceMainFilePath`:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  sourceMainFilePath: "./main.html",
});
```

## 2.3 ribbon

When a project has a server for build files it becomes hard to tell if a browser is displaying source files or build files. To differentiate them, one have:

1. to look at the url
2. check the port
3. know that server for source files is started on port `3456`

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

## 2.4 Error overlay

The error overlay is a visual element displayed when there is an error:

![image](https://github.com/jsenv/core/assets/443639/3ecd51ac-7851-4201-93dd-30892e23f11c)

It complements error(s) displayed in browser devtools. Error overlay exists because many errors happen during dev and it is very handy to have a feedback.

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

Check [tests/dev_server/errors/screenshots/](https://github.com/jsenv/core/tree/0bc86149826da9b69ac6c90c3911de033087f68f/tests/dev_server/errors/sceenshots) for more examples.

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

## 2.5 Browser support

The following browsers can be used to open files served by the dev server:

- Chrome 64+
- Safari 11.3+
- Edge 79+
- Firefox 67+
- Opera 51+
- Safari on IOS 12+
- Samsung Internet 9.2+

☝️ An other browser or an older version will likely fail to properly execute the code.

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

See the list of plugins in [G) Jsenv plugins](<G)-Jsenv-plugins>)

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

<table>
 <tr>
  <td width="2000px" align="left" nowrap>
   <a href="./a_introduction.md">< A) Introduction</a>
  </td>
  <td width="2000px" align="right" nowrap>
   <a href="./c_build.md">> C) Build</a>
  </td>
 </tr>
<table>
