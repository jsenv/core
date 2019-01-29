import { rollup } from "rollup"
import transformAsyncToPromises from "babel-plugin-transform-async-to-promises"
import { resolveImport } from "@jsenv/module-resolution"
import transformModulesSystemJs from "../babel-plugin-transform-modules-systemjs/index.js"
import { startCompileServer } from "../server-compile/index.js"
import { fetchUsingHttp } from "../platform/node/fetchUsingHttp.js"
import { readSourceMappingURL } from "../replaceSourceMappingURL.js"
import { transpiler } from "../jsCompile/transpiler.js"
import { resolveURL } from "./resolveURL.js"

// list of things to do in order:
// - multiple bundle generation looping though compileMap.json profiles
// - create an entry file to decide which bundle to load (inside node and inside browser)
// - make asyncAwaitIsRequired depends on compileMap.json -> check if every browser
// for that compileId inside compileMap.json support async/await

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
    let map

    const result = await transpiler({
      input: code,
      fileAbsolute,
      plugins: [[transformModulesSystemJs, { topLevelAwait: true }]],
    })
    code = result.code
    map = result.map

    // must check if required using some api +
    // compileMap.json
    const asyncAwaitIsRequired = true
    if (asyncAwaitIsRequired) {
      const result = await transpiler({
        input: code,
        fileAbsolute,
        plugins: [transformAsyncToPromises],
      })
      code = result.code
      map = result.map
    }

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
