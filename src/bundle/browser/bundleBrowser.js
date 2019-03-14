import { normalizePathname } from "@jsenv/module-resolution"
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
  globalName,
  entryPointsDescription,
  babelPluginDescription,
  compileGroupCount = 1,
  platformScoring = browserScoring,
  verbose,
}) => {
  projectFolder = normalizePathname(projectFolder)
  const hasBalancing = compileGroupCount > 1

  if (hasBalancing) {
    if (typeof globalPromiseName !== "string")
      throw new TypeError(
        `when balancing, globalPromiseName must be a string, got ${globalPromiseName}.`,
      )
    if (typeof globalName !== "undefined")
      throw new TypeError(`when balancing, globalName must be undefined, got ${globalPromiseName}.`)

    globalName = globalPromiseNameToGlobalName(globalPromiseName)
  } else {
    if (typeof globalName !== "string")
      throw new TypeError(`globalName must be a string, got ${globalName}.`)
    if (typeof globalPromiseName !== "undefined")
      throw new TypeError(`globalPromiseName must be undefined, got ${globalPromiseName}.`)
  }

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
