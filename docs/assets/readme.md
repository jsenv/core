# Using asset ressources

Import assertions can be used to on JSON and CSS ressources.

```js
import json from "./data.json" assert { type: "json" }

console.log(json)
```

```js
import sheet from "./style.css" assert { type: "css" }

document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
```

Dynamic import assertion can be used too.

```js
const jsonModule = await import("./data.json", {
  assert: { type: "json" },
})
console.log(jsonModule.default)
```

You can also use `new URL() + import meta url` to obtain a ressource url.

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
