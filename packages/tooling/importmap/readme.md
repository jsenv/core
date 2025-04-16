# importmap [![npm package](https://img.shields.io/npm/v/@jsenv/importmap.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/importmap) [![github main workflow](https://github.com/jsenv/importmap/workflows/main/badge.svg)](https://github.com/jsenv/importmap/actions?workflow=main) [![codecov coverage](https://codecov.io/gh/jsenv/importmap/branch/master/graph/badge.svg)](https://codecov.io/gh/jsenv/importmap)

`@jsenv/importmap` can be used to implement the behaviour of importmap as described in the [WICG specification](https://github.com/WICG/import-maps). It is written using ES modules and compatible with browsers and Node.js. Amongst other things, this repository is used to provide [importmap in ESLint](https://github.com/jsenv/importmap-eslint-resolver#presentation).

# Installation

```console
npm install @jsenv/importmap
```

# composeTwoImportMaps

_composeTwoImportMaps_ takes two _importMap_ and return a single _importMap_ being the composition of the two.

```js
import { composeTwoImportMaps } from "@jsenv/importmap"

const importMap = composeTwoImportMaps(
  {
    imports: {
      foo: "bar",
    },
  },
  {
    imports: {
      foo: "whatever",
    },
  },
)

console.log(JSON.stringify(importMap, null, "  "))
```

```console
{
  "imports": {
    "foo": "whatever"
  }
}
```

# normalizeImportMap

_normalizeImportMap_ returns an _importMap_ resolved against an _url_ and sorted.

```js
import { normalizeImportMap } from "@jsenv/importmap"

const importMap = normalizeImportMap(
  {
    imports: {
      foo: "./bar",
      "./ding.js": "./dong.js"
    },
  },
  "http://your-domain.com",
)

console.log(JSON.stringify(importMap, null, '  ')
```

```console
{
  "imports": {
    "foo": "http://your-domain.com/bar",
    "http://your-domain.com/ding.js": "http://your-domain.com/dong.js"
  }
}
```

# resolveImport

_resolveImport_ returns an import _url_ applying an _importMap_ to _specifier_ and _importer_. The provided _importMap_ must be resolved and sorted to work as expected. You can use [normalizeImportMap](#normalizeimportmap) to do that.

```js
import { resolveImport } from "@jsenv/importmap"

const importUrl = resolveImport({
  specifier: "../index.js",
  importer: "http://domain.com/folder/file.js",
  importMap: {
    imports: {
      "http://domain.com/index.js": "http://domain.com/main.js",
    },
  },
})

console.log(importUrl)
```

```console
http://domain.com/main.js
```

# moveImportMap

_moveImportMap_ receives _importMap_, _fromUrl_, _toUrl_ and return an importmap where all relative urls and specifiers becomes relative to _toUrl_ instead of _fromUrl_.

This function exists in case you need to move an importmap file somewhere else in the filesystem. This is not a common use case but might happen.

```js
import { moveImportMap } from "@jsenv/importmap"

const importMapMoved = moveImportMap(
  {
    imports: {
      foo: "./foo.js",
    },
  },
  "file:///project/project.importmap",
  "file:///project/dir/project.importmap",
)
console.log(JSON.stringify(importMap, null, '  ')
```

```console
{
  "imports": {
    "foo": "../foo.js",
  }
}
```
