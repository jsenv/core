# Importing code written in CommonJS

CommonJS module format rely on `module.exports` and `require`. It was invented by Node.js and is not standard JavaScript. Let's assume you want to import "file.js" written in CommonJS:

_file.js_:

```js
module.exports = 42
```

Importing "file.js" above would not work in a browser.

```js
import value from "./file.js"

console.log(value)
```

The code in "file.js" must be converted to esmodule. You can do this using "commonJsToJavaScriptModule".

In _jsenv.config.mjs_:

```js
import { commonJsToJavaScriptModule } from "@jsenv/core"

export const customCompilers = {
  "./file.js": commonJsToJavaScriptModule,
}
```

In practice it's not one of your files that is written in CommonJS but rather one of your dependency. For example "commonJsToJavaScriptModule" can be used to convert react to esmodule.

```js
import { commonJsToJavaScriptModule } from "@jsenv/core"

export const customCompilers = {
  "./node_modules/react/index.js": commonJsToJavaScriptModule,
  "./node_modules/react-dom/index.js": (options) => {
    return commonJsToJavaScriptModule({ ...options, external: ["react"] })
  },
}
```
