## TypeScript (experimental)

_jsenv.config.mjs for TypeScript_:

```js
import { createRequire } from "module"

const require = createRequire(import.meta.url)
const transformTypeScript = require("@babel/plugin-transform-typescript")

export const babelPluginMap = {
  "transform-typescript": [transformTypeScript, { allowNamespaces: true }],
}

export const importDefaultExtension = true
```

See also

- [babelPluginMap](./docs/shared-parameters.md#babelPluginMap)
- [importDefaultExtension](./docs/shared-parameters.md#importDefaultExtension)
- [transform-typescript on babel](https://babeljs.io/docs/en/next/babel-plugin-transform-typescript.html)
