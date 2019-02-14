import { browserScoring } from "../../group-description/index.js"
import { bundlePlatform } from "../bundlePlatform.js"
import { computeRollupOptionsWithoutBalancing } from "./computeRollupOptionsWithoutBalancing.js"
import { computeRollupOptionsWithBalancing } from "./computeRollupOptionsWithBalancing.js"
import { computeRollupOptionsForBalancer } from "./computeRollupOptionsForBalancer.js"
import { generateBalancerPages } from "./generateBalancerPages.js"

export const bundleBrowser = async ({
  projectFolder,
  into,
  globalName,
  entryPointsDescription,
  babelPluginDescription,
  compileGroupCount = 2,
  platformScoring = browserScoring,
}) => {
  if (typeof globalName !== "string")
    throw new TypeError(`bundleBrowser globalName must be a string, got ${globalName}`)

  return await Promise.all([
    bundlePlatform({
      entryPointsDescription,
      projectFolder,
      into,
      globalName,
      babelPluginDescription,
      compileGroupCount,
      platformScoring,
      computeRollupOptionsWithoutBalancing: (context) =>
        computeRollupOptionsWithoutBalancing({
          projectFolder,
          into,
          globalName,
          entryPointsDescription,
          babelPluginDescription,
          ...context,
        }),
      computeRollupOptionsWithBalancing: (context) =>
        computeRollupOptionsWithBalancing({
          projectFolder,
          into,
          entryPointsDescription,
          ...context,
        }),
      computeRollupOptionsForBalancer: (context) =>
        computeRollupOptionsForBalancer({
          projectFolder,
          into,
          globalName,
          ...context,
        }),
    }),
    generateBalancerPages({
      projectFolder,
      into,
      globalName,
      entryPointsDescription,
    }),
  ])
}

/*
forceBalancing is true because:

The consumer of a bundle does not have to know if it is balanced or not.
But it needs a uniform way of consuming it.

The way to consume a balanced bundle looks like that:

  ```html
<script src="node_modules/api/dist/browser/index.js"></script>
<script>
  window[`__apiPromise__`].then((api) => {
    console.log(api)
  })
</script>
```

Under the hood browser/index.js load one of the two files below.

dist/browser/best/index.js
```js
const api = (() => 42)()
```

dist/browser/otherwise/index.js
```js
var api = (function () { return 42 })()
```

If there is no balancing your don't want to do an additionnal http request
to get the api.
To do that rollup should output something like
window[`__apiPromise__`] = Promise.resolve(())
*/
