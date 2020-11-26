# Table of contents

- [Presentation](#Presentation)
- [top level await](#top-level-await)
- [dynamic import](#dynamic-import)
- [importMap](#importmap)
- [import.meta.resolve](#import.meta.resolve)
- [import.meta.url](#import.meta.url)
- [import with leading slash](#import-with-leading-slash)
- [import json](#import-json)
- [import css](#import-css)
- [import html](#import-html)
- [import svg](#import-svg)
- [import text](#import-text)
- [globalThis](#globalthis)

# Presentation

Some syntax are compatible only with a subset of build formats. For instance `commonjs` throw an error if it encounters a `top level await`.

This documents what you can and cannot do when building project.

# top level await

```js
const answer = await Promise.resolve(42)
```

Compatibility: ~~`global`~~, ~~`commonjs`~~, `systemjs`.

# dynamic import

```js
import("./file.js").then((namespace) => {
  console.log(namespace)
})
```

Compatibility: ~~`global`~~, `commonjs`, `systemjs`.

# importMap

```js
import memoize from "lodash"
// search file at "/node_modules/lodash/index.js"
```

Compatibility: `global`, `commonjs`, `systemjs`.

# import.meta.resolve

```js
import.meta.resolve("./file.js")

const lodashHref = import.meta.resolve("lodash")
// importMap are applied so that lodashHref is remapped to /node_modules/lodash/index.js
// if your importMap says so
```

Compatibility: `global`, `commonjs`, `systemjs`.

# import.meta.url

```js
const whereAMI = import.meta.url
```

Compatibility: `global`, `commonjs`, `systemjs`.

# import with leading slash

```js
import "/src/file.js"
// search file at "/Users/you/folder/src/file.js"
```

Compatibility: `global`, `commonjs`, `systemjs`.

# import json

```js
import data from "./data.json"
```

Compatibility: `global`, `commonjs`, `systemjs`.

# import css

```js
import cssText from "./style.css"
```

Compatibility: `global`, `commonjs`, `systemjs`.

# import css

```js
import cssText from "./style.css"
```

Compatibility: `global`, `commonjs`, `systemjs`.

# import html

```js
import htmlText from "./style.html"
```

Compatibility: `global`, `commonjs`, `systemjs`.

# import svg

```js
import svgText from "./icon.svg"
```

Compatibility: `global`, `commonjs`, `systemjs`.

# import text

```js
import text from "./data.text"
```

Compatibility: `global`, `commonjs`, `systemjs`.

# globalThis

```js
globalThis.console.log("Hello")
```

Compatibility: `global`, `commonjs`, `systemjs`.
