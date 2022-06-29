# Assets and workers

Or how to use files that are not js modules within a js module.

## Web workers

```js
const worker = new Worker("/worker.js", { type: "module" })
```

```js
navigator.serviceWorker.register("/service_worker.js", { type: "module" })
```

You can also use the "non module" notation. Jsenv detect this during static analysis and knows the worker file format is "classic": a single file eventually using [self.importScripts](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/importScripts).

```js
const worker = new Worker("/worker.js")
navigator.serviceWorker.register("/service_worker.js")
```

## JSON

```js
import json from "./data.json" assert { type: "json" }

console.log(json)
```

> **Note**
> Code is transformed if browser do not support import assertion

You can also use a dynamic import

```js
const jsonModule = await import("./data.json", {
  assert: { type: "json" },
})

console.log(jsonModule.default)
```

## CSS

```js
import sheet from "./style.css" assert { type: "css" }

document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
```

> **Note**
> Code is transformed if browser do not support import assertion or `document.adoptedStyleSheets`.

You can also use a dynamic import

```js
const sheet = await import("./style.css", {
  assert: { type: "css" },
})

document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
```

It's also possible to reference CSS file with a url

```js
const cssFileUrl = new URL("./style.css", import.meta.url)

const link = document.createElement("link")
link.rel = "stylesheet"
link.href = cssFileUrl
document.head.appendChild(link)
```

## Images (and everything else)

Any of your file can be referenced using `new URL() + import meta url`. It will give you an url for that ressource that can be used later.

```js
const imageUrl = new URL("./img.png", import.meta.url)

const img = document.createElement("img")
img.src = imageUrl
document.body.appendChild(img)
```

## Content from CDN

External urls are kept intact. In the following HTML, jsenv keep url to roboto font intact during dev and in the build files.

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Roboto"
      crossorigin="anonymous"
    />
    <style>
      body {
        font-family: Roboto;
      }
    </style>
  </head>

  <body>
    Hello world
  </body>
</html>
```

<!-- Part below commented until the jsenv plugin for http urls is done -->
<!-- There is 2 circumstances where you might want to change this default behaviour:

1. You want to remove dependency to external urls in your build files
2. You want to transform code served by the CDN before it gets executed

## Remove CDN urls during build

Pass "preservedUrls" to "buildProject".

```diff
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryRelativeUrl: "dist",
  entryPoints: {
    "./main.html": "main.prod.html",
  },
  format: "esmodule",
+ preservedUrls: {
+   "https://fonts.googleapis.com/": false
+ }
})
```

Each url associated to false using "preservedUrls" will be fetched and turned into a file. The HTML file generated in the build directory will use a relative url instead of the CDN url.

```diff
<link
   rel="stylesheet"
-  href="https://fonts.googleapis.com/css2?family=Roboto"
+  href="assets/roboto_32789f.css"
/>
```

## Transform code served by CDN

For this use case let's assume you want to execute JavaScript from a CDN but code served by the CDN cannot be executed as it is. For example if you need to support old browsers where import/export is not supported.

```js
import { h, render } from "https://cdn.skypack.dev/preact@10.6.4"
```

To make this happen, tell jsenv it can transform code behind "`https://cdn.skypack.dev/preact@10.6.4`" using "preservedUrls":

```diff
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryRelativeUrl: "dist",
  entryPoints: {
    "./main.html": "main.prod.html",
  },
  format: "esmodule",
+ preservedUrls: {
+   "https://cdn.skypack.dev/preact@10.6.4": false
+ }
})
```

When you pass a custom "preservedUrls" to "buildProject" it's recommended to also pass it to "startDevServer" and "executeTestPlan". -->

<!-- ### With customCompilers

You can import non-js ressources using static import as shown below

```js
import text from "./data.txt"

console.log(text)
```

However this cannot run directly in the browser. It needs to be transformed to be executable by a browser.
This can be achieved by associating `"**/*.txt"` with `textToJsModule` in [customCompilers](https://github.com/jsenv/jsenv-core/blob/master/docs/shared-parameters.md#customcompilers). -->
