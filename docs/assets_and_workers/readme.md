# Assets and workers

This documentation shows how to use files that are not js modules from a js module.

## Using web workers

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

## Using JSON

```js
import json from "./data.json" assert { type: "json" }

console.log(json)
```

You can also use a dynamic import

```js
const jsonModule = await import("./data.json", {
  assert: { type: "json" },
})

console.log(jsonModule.default)
```

## Using CSS

```js
import sheet from "./style.css" assert { type: "css" }

document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
```

You can also use a dynamic import

```js
const sheet = await import("./style.css", {
  assert: { type: "css" },
})

document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
```

It's also possible to reference the file by its url

```js
const cssFileUrl = new URL("./style.css", import.meta.url)

const link = document.createElement("link")
link.rel = "stylesheet"
link.href = cssFileUrl
document.head.appendChild(link)
```

## Using images (and everything else)

Any of your file can be referenced using `new URL() + import meta url`. It will give you an url for that ressource that can be used later.

```js
const imageUrl = new URL("./img.png", import.meta.url)

const img = document.createElement("img")
img.src = imageUrl
document.body.appendChild(img)
```

<!-- ### With customCompilers

You can import non-js ressources using static import as shown below

```js
import text from "./data.txt"

console.log(text)
```

However this cannot run directly in the browser. It needs to be transformed to be executable by a browser.
This can be achieved by associating `"**/*.txt"` with `textToJsModule` in [customCompilers](https://github.com/jsenv/jsenv-core/blob/master/docs/shared-parameters.md#customcompilers). -->
