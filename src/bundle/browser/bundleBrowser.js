import { browserScoring } from "../../group-description/index.js"
import { bundlePlatform } from "../bundlePlatform.js"
import { computeRollupOptionsWithoutBalancing } from "./computeRollupOptionsWithoutBalancing.js"
import { computeRollupOptionsWithBalancing } from "./computeRollupOptionsWithBalancing.js"
import { computeRollupOptionsForBalancer } from "./computeRollupOptionsForBalancer.js"
import { generateBalancerPages } from "./generateBalancerPages.js"

export const bundleBrowser = async ({
  projectFolder,
  importMap,
  into,
  globalPromiseName,
  entryPointsDescription,
  babelPluginDescription,
  compileGroupCount = 2,
  platformScoring = browserScoring,
  autoWrapEntryInPromise = false,
  verbose,
}) => {
  if (typeof globalPromiseName !== "string")
    throw new TypeError(
      `bundleBrowser globalPromiseName must be a string, got ${globalPromiseName}`,
    )

  const globalName = globalPromiseNameToGlobalName(globalPromiseName)

  return await Promise.all([
    bundlePlatform({
      entryPointsDescription,
      projectFolder,
      into,
      babelPluginDescription,
      compileGroupCount,
      platformScoring,
      verbose,
      computeRollupOptionsWithoutBalancing: (context) =>
        computeRollupOptionsWithoutBalancing({
          importMap,
          projectFolder,
          into,
          globalPromiseName,
          globalName,
          entryPointsDescription,
          babelPluginDescription,
          autoWrapEntryInPromise,
          ...context,
        }),
      computeRollupOptionsWithBalancing: (context) =>
        computeRollupOptionsWithBalancing({
          importMap,
          projectFolder,
          into,
          globalName,
          entryPointsDescription,
          babelPluginDescription,
          ...context,
        }),
      computeRollupOptionsForBalancer: (context) =>
        computeRollupOptionsForBalancer({
          importMap,
          projectFolder,
          into,
          globalPromiseName,
          globalName,
          babelPluginDescription,
          ...context,
        }),
    }),
    generateBalancerPages({
      projectFolder,
      into,
      entryPointsDescription,
    }),
  ])
}

const globalPromiseNameToGlobalName = (globalPromiseName) => `__${globalPromiseName}Value__`

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
