# Assets and workers

Or how to reference files and create web workers.

## JSON

```js
import json from "./data.json" assert { type: "json" }

console.log(json)
```

> **Note**
> Code is transformed if browser do not support import assertion

You can also use a dynamic import:

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

You can also use a dynamic import:

```js
const sheet = await import("./style.css", {
  assert: { type: "css" },
})

document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
```

It's also possible to reference CSS file with an url:

```js
const cssFileUrl = new URL("./style.css", import.meta.url)

const link = document.createElement("link")
link.rel = "stylesheet"
link.href = cssFileUrl
document.head.appendChild(link)
```

## Text

```js
import text from "./data.txt" assert { type: "text" }

console.log(text)
```

> **Note**
> Code is always transformed because "text" is not yet a standard import assertion

## Images (and everything else)

Any of your file can be referenced using `new URL() + import meta url`.
It will give you an url for that resource that can be used later.

```js
const imageUrl = new URL("./img.png", import.meta.url)

const img = document.createElement("img")
img.src = imageUrl
document.body.appendChild(img)
```

When js is executed by `<script></script>` and not `<script type="module"></script>`, an other solution must be used:

```js
const url = new URL("./img.png", document.currentScript.src)
```

## Content from CDN

External urls are kept intact.
In the following HTML, jsenv keeps url to roboto font intact during dev and in the build files.

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
<!-- There is 2 circumstances where you might want to change the external url

1. You want to remove dependency to external urls in your build files
2. You want to transform code served by the CDN before it gets executed

### Remove CDN urls during build

Pass "preservedUrls" to "build".

```diff
import { build } from "@jsenv/core"

await build({
  rootDirectoryUrl: new URL("./", import.meta.url),
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

### Transform CDN content

For this use case let's assume you want to execute JavaScript from a CDN but code served by the CDN cannot be executed as it is. For example if you need to support old browsers where import/export is not supported.

```js
import { h, render } from "https://cdn.skypack.dev/preact@10.6.4"
```

```diff
import { startDevServer } from "@jsenv/core"

await startDevServer({
  rootDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryRelativeUrl: "dist",
  entryPoints: {
    "./main.html": "main.prod.html",
  },
  format: "esmodule",
+ preservedUrls: {
+   "https://cdn.skypack.dev/": false
+ }
})
```

> **Warning**
> Be sure to pass "preservedUrls" to startDevServer, executeTestPlan and build

--->

## Worker

```js
const worker = new Worker("/worker.js", {
  type: "module",
})
```

You can also use the "non module" notation. Then the file must be written in "classic" worker format: a single file eventually using [self.importScripts](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/importScripts).

```js
const worker = new Worker("/worker.js")
```

## Service worker

```js
navigator.serviceWorker.register("/service_worker.js", {
  type: "module",
})
```

You can also use the "non module" notation. Then the file must be written in "classic" worker format: a single file eventually using [self.importScripts](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/importScripts).

```js
navigator.serviceWorker.register("/service_worker.js")
```
