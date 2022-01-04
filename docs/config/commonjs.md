# Configuring jsenv for CommonJS

CommonJS module format rely on `module.exports` and `require`. It was invented by Node.js and is not standard JavaScript. If your code or one of your dependency uses it, it requires some configuration. The jsenv config below makes jsenv compatible with a package named _"whatever"_ that would be written in CommonJS.

_jsenv.config.mjs to use code written in CommonJS_:

```js
import { commonJsToJavaScriptModule } from "@jsenv/core"

export const customCompilers = {
  "./node_modules/whatever/index.js": commonJsToJavaScriptModule,
}
```
