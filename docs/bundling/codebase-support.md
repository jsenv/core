# Table of contents

- [Supported codebase](#supported-codebase)
  - [top level await](#top-level-await)
  - [dynamic import](#dynamic-import)
  - [importMap](#importmap)
  - [import.meta.resolve](#import.meta.resolve)
  - [import.meta.url](#import.meta.url)
  - [import with leading slash](#import-with-leading-slash)
  - [import json](#import-json)
  - [globalThis](#globalthis)

# Supported codebase

`@jsenv/bundling` can work with syntax like `top level await`.<br />
However some syntax are compatible only with a subset of the available bundle formats.<br />
For instance `generateCommonJsBundle` throw an error if it encounters a `top level await` in your codebase.<br />

You can find below some code examples and the associated bundle format compatibility.

## top level await

```js
const answer = await Promise.resolve(42)
```

Compatibility: ~~`global`~~, ~~`commonjs`~~, `systemjs`.

## dynamic import

```js
import("./file.js").then((namespace) => {
  console.log(namespace)
})
```

Compatibility: ~~`global`~~, `commonjs`, `systemjs`.

## importMap

```js
import memoize from "lodash"
// search file at "/node_modules/lodash/index.js"
```

Compatibility: `global`, `commonjs`, `systemjs`.

## import.meta.resolve

```js
import.meta.resolve("./file.js")

const lodashHref = import.meta.resolve("lodash")
// importMap are applied so that lodashHref might be /node_modules/lodash/index.js
```

Compatibility: `global`, `commonjs`, `systemjs`.

## import.meta.url

```js
const whereAMI = import.meta.url
```

Compatibility: `global`, `commonjs`, `systemjs`.

## import with leading slash

```js
import "/src/file.js"
// search file at "/Users/you/folder/src/file.js"
```

Compatibility: `global`, `commonjs`, `systemjs`.

## import json

```js
import data from "./data.json"
```

Compatibility: `global`, `commonjs`, `systemjs`.

## globalThis

```js
globalThis.console.log("Hello")
```

Compatibility: `global`, `commonjs`, `systemjs`.
