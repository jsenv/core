import { rollup } from "rollup"
import { resolveImport } from "@jsenv/module-resolution"
import transformAsyncToPromises from "babel-plugin-transform-async-to-promises"
import transformModulesSystemJs from "../babel-plugin-transform-modules-systemjs/index.js"
import { startCompileServer } from "../server-compile/index.js"
import { fetchUsingHttp } from "../platform/node/fetchUsingHttp.js"
import { readSourceMappingURL } from "../replaceSourceMappingURL.js"
import { transpiler } from "../jsCompile/transpiler.js"
import { resolveURL } from "./resolveURL.js"

/* OTHER PROPOSAL

## index.html

<script src="system.dist.js"></script>
<script>
  // 1: load compileGroup.json
  // 2: deduce compileId
  // 3: load and execute bundle/${compileId}/__main-module-static-dependencies-cache__.js
  // 4: import main module
  const mainModule = `${bundle}/${compileId}/index.js`
  // mainModule and static dependencies are already available thanks to
  // evaluation of bundle/${compileId}/__main-module-static-dependencies-cache__.js
  System.import(mainModule)
</script>

## Consequences

- dynamic import would not be concatened
- no tree shaking

## Why

I think that:

- Dynamic import with bundling is complex and not robust.
- What matters most is initial rendering.

And assuming dynamically imported code comes to add functionnality to a running application.

- There is less speed pressure on dynamically imported code than static one

In the end
- dynamic import use browser cache
- dynamic import are more robust because not coupled with the bundling mecasnim

## How

- Create or empty a bundle folder
- a function receive main module path and compile himself + all his **static import**
for all registered profiles into bundle
- generate all corresponding __main-module-static-dependencies-cache__.js
*/

// list of things to do in order:
// - create an entry file to decide which bundle to load (inside node and inside browser)
/*
ce fichier commencerait par regarder s'il est dans browser ou nodejs
en fonction il loaderais un autre fichier d'entrée

bundle/
  index.js
    si executé depuis node fait require('./index.node.js')
    si depuis browser inject un script './index.browser.js'

  index.node.js
    load compileMap.json
    load nodeSystem
    System.import('./best/index.js')

  index.browser.js
    load compileMap.json
    load browserSystem
    System.import('./best/index.js')

  compileMap.json
    contient des infos sur best,worst,otherwise
  best/
    les fichiers compilé pour le profile best
  worst/
    les fichiers compilé pour le profile worst
  otherwise/
    les fichiers compilé pour le profile otherwise

but truth is like this:

because nodejs needs systemjs to operate and does not works with top level await
we will certainly launch nodejs code using the dedicated launch-node process

because browser needs anyway an index.html to operate, we will just output
index.browser.js that is already available somehow in
startBrowserServer.js or launchChromium

to have an index.html file able to run the bundled code
we would need the following architecture

dist/
  bundle/
    best/
      index.js
    worst/
      index.js
  compileMap.json
  main-browser.js
    would inject a script tag for systemjs
    would fetch compileMap.json
    would decide which file to load according to current context and compileMap.json
    would do System.import('./bundle/${compileId}/index.js')
  main-node.js
    could create a nodeSystem
    but here we need to instantiate file using file system instead of remote server
    would load compileMap.json as well
    would module.exports = System.import('./bundle/${compileId}/index.js')

- you could define an index.html injecting dist/main-browser.js and it would work
- you could write const main = require('main-node.js')
but you would have to await main to get the exports
*/

export const bundle = async ({
  ressource,
  into,
  root,
  compileGroupCount = 1,
  pluginMap = {},
  pluginCompatMap,
  platformUsageMap,
  format = "systemjs",
  allowTopLevelAwait = true,
}) => {
  if (!ressource) throw new TypeError(`bundle expect a ressource, got ${ressource}`)
  if (!into) throw new TypeError(`bundle expect into, got ${into}`)
  if (!root) throw new TypeError(`bundle expect root, got ${root}`)
  if (format !== "systemjs" && format !== "commonjs")
    throw new TypeError(`unexpected format, got ${format}`)
  if (allowTopLevelAwait && format === "commonjs")
    throw new Error(`"commonjs" format is not compatible with top level await`)

  const localRoot = root
  const bundleInto = into
  // bon ça serais mieux soit de reuse le dossier build (yes a fond)
  // ouais y'a pas a dire il faut faire ça
  // en gardant a l'esprit que transform modules systemjs pour le moment
  // bah il fait pas partie du pluginMap mais se retrouve bien dans le resultat final
  const compileInto = `${bundleInto}/cache`

  const server = await startCompileServer({
    localRoot,
    compileInto,
    compileGroupCount,
    pluginMap,
    pluginCompatMap,
    platformUsageMap,
  })

  const remoteRoot = server.origin
  const compileMapResponse = await fetchUsingHttp(`${remoteRoot}/${compileInto}/compileMap.json`)
  const compileMap = JSON.parse(compileMapResponse.body)

  await Promise.all(
    Object.keys(compileMap).map((compileId) => {
      return bundleGroup({
        ressource,
        remoteRoot,
        localRoot,
        bundleInto,
        compileInto,
        compileId,
        format,
        allowTopLevelAwait,
      })
    }),
  )

  server.stop()
}

const bundleGroup = async ({
  ressource,
  remoteRoot,
  localRoot,
  bundleInto,
  compileInto,
  compileId,
  format,
  allowTopLevelAwait,
}) => {
  const resolveId = (importee, importer) => {
    if (!importer) return importee
    return resolveImport({
      moduleSpecifier: importee,
      file: importer,
      root: localRoot,
      useNodeModuleResolutionInsideDedicatedFolder: true,
    })
  }

  // https://rollupjs.org/guide/en#transform
  const transform = async (code, id) => {
    const ressource = id.slice(localRoot.length + 1)
    const remoteURL = `${remoteRoot}/${compileInto}/${compileId}/${ressource}`
    const moduleResponse = await fetchUsingHttp(remoteURL)

    const sourceMappingURL = readSourceMappingURL(moduleResponse.body)
    const resolvedSourceMappingURL = resolveURL(moduleResponse.url, sourceMappingURL)
    const sourceMapResponse = await fetchUsingHttp(resolvedSourceMappingURL)
    return { code: moduleResponse.body, map: JSON.parse(sourceMapResponse.body) }
  }

  // https://rollupjs.org/guide/en#renderchunk
  // needed to transform top level await
  // and also the async keyword used here
  // https://github.com/rollup/rollup/blob/38f3ca676ba67d740ef5cd2967f8412f80feeafe/src/finalisers/system.ts#L185
  const renderChunk = async (code, chunk) => {
    if (format === "cjs") return null
    if (!allowTopLevelAwait) return null

    const fileAbsolute = chunk.facadeModuleId

    const result = await transpiler({
      input: code,
      fileAbsolute,
      pluginMap: {
        // if every browser for that compileId inside compileMap.json supports
        "transform-modules-systemjs": [transformModulesSystemJs, { topLevelAwait: true }],
        // async/await, no need to pass transform-async-to-promises below
        "transform-async-to-promises": [transformAsyncToPromises],
      },
    })
    code = result.code
    const map = result.map

    return { code, map }
  }

  const jsenvRollupPlugin = {
    name: "jsenv",
    // not really required, we can read from filesystem
    // load: async (id) => {
    // },
    resolveId,
    // https://rollupjs.org/guide/en#resolvedynamicimport
    // resolveDynamicImport: () => {
    //   return false
    // },
    transform,
    renderChunk,
  }

  const file = `${localRoot}/${ressource}`
  const options = {
    input: file,
    plugins: [jsenvRollupPlugin],
    // required here so that acorn can parse the module
    experimentalTopLevelAwait: allowTopLevelAwait,
    // skip rollup warnings
    // onwarn: () => {},
  }
  const rollupBundle = await rollup(options)

  const result = await rollupBundle.write({
    // https://rollupjs.org/guide/en#output-dir
    dir: `${localRoot}/${bundleInto}/${compileId}`,
    // https://rollupjs.org/guide/en#output-format
    format: format === "systemjs" ? "es" : "cjs",
    // https://rollupjs.org/guide/en#output-sourcemap
    sourcemap: true,
    sourcemapExcludeSources: true,
    // https://rollupjs.org/guide/en#experimentaltoplevelawait
    experimentalTopLevelAwait: allowTopLevelAwait,
  })

  return result
}
