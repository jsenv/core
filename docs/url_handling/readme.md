# Using asset ressources

An asset is a file that is not a JavaScript module. The following ressources are assets: CSS, images, JSON, SVG, fonts, ...

The following way to use assets are recommended:

1. With HTML tags
2. With import.meta.url
3. With import assertions

## With HTML tags

Some assets will be referenced directly in the HTML using `<link>` or `<img>` for instance.

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link rel="icon" href="./favicon.ico" />
    <link rel="stylesheet" type="text/css" href="./main.css" />
  </head>
  <body>
    Hello world
  </body>
</html>
```

## With import.meta.url

Any of your file can be referenced using `new URL() + import meta url`. It will give you an url for that ressource that can be used later. See the following example where JS is referencing an image url.

```js
const imageUrl = new URL("./img.png", import.meta.url)

const img = document.createElement("img")
img.src = imageUrl
document.body.appendChild(img)
```

## With import assertions

If the file you want to use is JSON or CSS you can use import assertions as shown below.

```js
import json from "./data.json" assert { type: "json" }

console.log(json)
```

```js
import sheet from "./style.css" assert { type: "css" }

document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
```

There is also dynamic import assertions:

```js
const jsonModule = await import("./data.json", {
  assert: { type: "json" },
})
console.log(jsonModule.default)
```

<!-- ### With customCompilers

You can import non-js ressources using static import as shown below

```js
import text from "./data.txt"

console.log(text)
```

However this cannot run directly in the browser. It needs to be transformed to be executable by a browser.
This can be achieved by associating `"**/*.txt"` with `textToJsModule` in [customCompilers](https://github.com/jsenv/jsenv-core/blob/master/docs/shared-parameters.md#customcompilers). -->
