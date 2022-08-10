# Assets and workers

Or how to reference files within a file.

It's recommended to prefer leading slash instead of `"../"`:

```diff
-  background-image: url(../../logo.png);
+  background-image: url(/src/logo.png);
```

- :+1: create consistent specifiers
- :+1: escape `"../../"` hell.

The rest of this page shows how files can be referenced within HTML, CSS and js.

This upcoming sections contains extract of code using recent features. Keep in mind that when a feature is not supported by a browser during dev of after build, code is transformed by jsenv to become compatible. This includes most remarkably:

- script type module
- worker type module
- import assertions
- document.adoptedStylesheets

> **Note**  
> External urls, like `https://fonts.googleapis.com/css2?family=Roboto`, are preserved during dev and in the build files.

## HTML

Inside HTML files the following way to reference files are supported:

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
    <link rel="preload" href="./image.jpg" />
    <link rel="preload" href="./script.js" as="script" />
    <link rel="modulepreload" href="./module.js" />
  </head>

  <body>
    Hello world
    <iframe href="./iframe.html"></iframe>
    <a href="./page.html">page</a>
    <picture>
      <source srcset="image_320.jpg 320w, image_640.jpg 640w" />
      <img src="image.jpg" alt="logo" />
    </picture>
    <script src="script.js"></script>
    <script type="module" src="module.js"></script>
  </body>
</html>
```

Even if it is not listed in the HTML above, everything part of the web standard is supported. This includes [`<link rel="manifest">`](https://developer.mozilla.org/en-US/docs/Web/Manifest#deploying_a_manifest) for instance.

## CSS

Inside CSS files the following ways to reference files are supported:

```css
@import "./file.css";

body {
  background-image: url(../../logo.png);
}
```

> **Note**  
> "@import" not yet allowed with [CSS import assertion](#CSS-import-assertion) as explained in https://web.dev/css-module-scripts/#@import-rules-not-yet-allowed

## Js module

Js module refers to js executed in a context where is has access to `import` and `import.meta.url`.<br />
In these files the following is supported:

### CSS import assertion

```js
import sheet from "./style.css" assert { type: "css" }

document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
```

And the dynamic import counterpart

```js
const sheet = await import("./style.css", {
  assert: { type: "css" },
})

document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
```

### CSS urls

```js
const cssFileUrl = new URL("./style.css", import.meta.url)

const link = document.createElement("link")
link.rel = "stylesheet"
link.href = cssFileUrl
document.head.appendChild(link)
```

### Image urls

```js
const imageUrl = new URL("./img.png", import.meta.url)

const img = document.createElement("img")
img.src = imageUrl
document.body.appendChild(img)
```

### Worker urls

Depending how the worker file is written one of the 2 solutions below must be used

#### Js classic worker

```js
const worker = new Worker(new URL("/worker.js", import.meta.url))
```

#### Js module worker

```js
const worker = new Worker(new URL("/worker.js", import.meta.url), {
  type: "module",
})
```

Jsenv also supports [serviceWorker.register()](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register) and [new SharedWorker()](https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker).

### JSON import assertion

```js
import data from "./data.json" assert { type: "json" }

console.log(data)
```

And the dynamic import counterpart

```js
const jsonModule = await import("./data.json", {
  assert: { type: "json" },
})

console.log(jsonModule.default)
```

### Text import assertion

```js
import text from "./data.txt" assert { type: "text" }

console.log(text)
```

## Js classic

When js is executed by `<script></script>` and not `<script type="module"></script>`, import is not available. In that case `document.currentScript.src` can be used as substitute of `import.meta.url`. So all the solutions involving urls raised in the js modules parts are still available.

```js
const imageUrl = new URL("./img.png", document.currentScript.src)

const img = document.createElement("img")
img.src = imageUrl
document.body.appendChild(img)
```

It's also possible to lazy load other files using [window.fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

```js
const jsonUrl = new URL("./data.json", document.currentScript.src)

const response = await window.fetch(jsonUrl)
const json = await response.json()
console.log(json)
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
