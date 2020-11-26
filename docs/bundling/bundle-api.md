- [Bundling parameters](#bundling-parameters)
  - [buildDirectoryRelativeUrl](#buildDirectoryRelativeUrl)
  - [entryPointMap](#entryPointMap)
  - [externalImportSpecifiers](#externalImportSpecifiers)
  - [minify](#minify)
- [Shared parameters](#Shared-parameters)

# Bundling parameters

This section present parameters available to every function generating a bundle.

## buildDirectoryRelativeUrl

`buildDirectoryRelativeUrl` parameter is a string leading to a directory where bundle files are written. This parameter is optional with a default value specific to each bundling function:

- Default for `esmodule` format:

  ```js
  "./dist/esmodule/"

  ```

- Default for `systemjs` format:

  ```js
  "./dist/systemjs/"

  ```

- Default for `commonjs` format:

  ```js
  "./dist/commonjs/"

  ```

- Default for `global` fromat:

  ```js
  "./dist/global/"

  ```

## entryPointMap

`entryPointMap` parameter is an object describing your project entry points. A dedicated bundle is generated for each entry. This parameter is optional with a default value assuming you have a single entry point being `main.html` or `main.js` depending the format you are using. Keys are relative to project directory and values are relative to bundle directory.

```json
{
  "./main.html": "./main.html"
}
```

## externalImportSpecifiers

`externalImportSpecifiers` parameter is an array of string repsenting import that will be ignored whle generating the bundle. This parameter is optional with a default value being an empty array. This parameter can be used to avoid bundling some dependencies.

To better understand this let's assume your source files contains the following import.

```js
import { answer } from "foo"

export const ask = () => answer
```

If `externalImportSpecifiers` contains `foo` the generated bundle will keep that import untouched and still try to load this file resulting in a bundle as below:

- For bundle using `esmodule` format:

  ```js
  import { answer } from "foo"

  export const ask = () => answer
  ```

- For bundle using `systemjs` format

  ```js
  System.register(["foo"], function (exports) {
    var answer
    return {
      setters: [
        function (module) {
          answer = module.answer
        },
      ],
      execute: function () {
        exports("ask", function ask() {
          return answer
        })
      },
    }
  })
  ```

- For bundle using `commonjs` format

  ```js
  const { answer } = require("foo")

  module.exports.ask = () => answer
  ```

- For bundle using `global` format:

  ```js
  ;(function (exports, foo) {
    var ask = function ask() {
      return foo.answer
    }

    exports.ask = ask
    return exports
  })({}, foo)
  ```

  It means bundle using `global` format expect `window.foo` or `global.foo` to exists. You can control the expected global variable name using `globals`.

  ```js
  import { generateGlobalBundle } from "@jsenv/core"

  generateGlobalBundle({
    externalImportSpecifiers: ["foo"],
    globals: {
      foo: "bar",
    },
  })
  ```

## minify

`minify` parameter is a boolean controlling if bundle content will be minified to save bytes. This parameter is optional.

# Shared parameters

To avoid duplication some parameter are linked to a generic documentation.

- [projectDirectoryUrl](../shared-parameters.md#projectDirectoryUrl)
- [jsenvDirectoryRelativeUrl](../shared-parameters.md#jsenvDirectoryRelativeUrl)
- [babelPluginMap](../shared-parameters.md#babelPluginMap)
- [convertMap](../shared-parameters.md#convertMap)
- [importMapFileRelativeUrl](../shared-parameters.md#importMapFileRelativeUrl)
- [importDefaultExtension](../shared-parameters.md#importDefaultExtension)
- [compileServerLogLevel](../shared-parameters.md#compileServerLogLevel)
- [compileServerProtocol](../shared-parameters.md#compileServerProtocol)
- [compileServerPrivateKey](../shared-parameters.md#compileServerPrivateKey)
- [compileServerCertificate](../shared-parameters.md#compileServerCertificate)
- [compileServerIp](../shared-parameters.md#compileServerIp)
- [compileServerPort](../shared-parameters.md#compileServerPort)
