# Using asset ressources

This documentation explains how jsenv expects you to reference non-js ressources.

## Using import assertions

Import assertions can be used to import JSON and CSS ressources.

```js
import json from "./data.json" assert { type: "json" }

console.log(json)
```

```js
import sheet from "./style.css" assert { type: "css" }

document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
```

Dynamic import assertion are also supported

```js
const jsonModule = await import("./data.json", {
  assert: { type: "json" },
})
console.log(jsonModule.default)
```

## Using import.meta.url

A ressource url can be referenced using `new URL() + import meta url`.

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
This can be achieved by associating `"**/*.txt"` with `textToJavaScriptModule` in [customCompilers](https://github.com/jsenv/jsenv-core/blob/master/docs/shared-parameters.md#customcompilers). -->
