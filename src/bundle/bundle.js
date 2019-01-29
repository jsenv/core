import { rollup } from "rollup"
import transformAsyncToPromises from "babel-plugin-transform-async-to-promises"
import { resolveImport } from "@jsenv/module-resolution"
import { pluginNameToPlugin } from "@dmail/project-structure-compile-babel"
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
  compileGroupCount,
  pluginMap = {},
  pluginCompatMap,
  platformUsageMap,
}) => {
  if (!ressource) throw new TypeError(`bundle expect a ressource, got ${ressource}`)
  if (!into) throw new TypeError(`bundle expect into, got ${into}`)
  if (!root) throw new TypeError(`bundle expect root, got ${root}`)

  // for now we will force systemjs output
  // (because of top level await amongst other reasons)
  // and compileMap will not mention it, it will be an exception
  // pluginMap = { ...pluginMap }
  // delete pluginMap["transform-modules-systemjs"]

  const server = await startCompileServer({
    localRoot: root,
    compileInto: into,
    compileGroupCount,
    pluginMap,
    pluginCompatMap,
    platformUsageMap,
  })

  const compileId = "worst"

  const jsenvRollupPlugin = {
    resolveId: (importee, importer) => {
      if (!importer) return importee
      return resolveImport({
        moduleSpecifier: importee,
        file: importer,
        root,
        useNodeModuleResolutionInsideDedicatedFolder: true,
      })
    },

    // not really required, we can read from filesystem
    // load: async (id) => {
    // },

    // https://rollupjs.org/guide/en#transform
    transform: async (code, id) => {
      const ressource = id.slice(root.length + 1)
      const remoteURL = `${server.origin}/${into}/${compileId}/${ressource}`
      const moduleResponse = await fetchUsingHttp(remoteURL)

      const sourceMappingURL = readSourceMappingURL(moduleResponse.body)
      const resolvedSourceMappingURL = resolveURL(moduleResponse.url, sourceMappingURL)
      const sourceMapResponse = await fetchUsingHttp(resolvedSourceMappingURL)

      return { code: moduleResponse.body, map: JSON.parse(sourceMapResponse.body) }
    },

    // https://rollupjs.org/guide/en#resolvedynamicimport
    // resolveDynamicImport: () => {
    //   return false
    // },

    // https://rollupjs.org/guide/en#renderchunk
    // needed to transform top level await
    // and also the async keyword used here
    // https://github.com/rollup/rollup/blob/38f3ca676ba67d740ef5cd2967f8412f80feeafe/src/finalisers/system.ts#L185
    renderChunk: async (code, chunk) => {
      const fileAbsolute = chunk.facadeModuleId
      let map

      const moduleOutputIsRequired = true
      if (moduleOutputIsRequired) {
        const result = await transpiler({
          input: code,
          fileAbsolute,
          plugins: [pluginNameToPlugin("transform-modules-systemjs")],
        })
        code = result.code
        map = result.map
      }

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
    },
  }

  const file = `${root}/${ressource}`
  const options = {
    input: file,
    plugins: [jsenvRollupPlugin],
    experimentalTopLevelAwait: true, // required here so that acorn can parse the module
    // skip rollup warnings
    // onwarn: () => {},
  }
  const rollupBundle = await rollup(options)

  const result = await rollupBundle.write({
    // https://rollupjs.org/guide/en#output-dir
    dir: `${root}/${into}`,
    // https://rollupjs.org/guide/en#output-format
    format: "es",
    // https://rollupjs.org/guide/en#output-sourcemap
    sourcemap: true,
    sourcemapExcludeSources: true,
    // https://rollupjs.org/guide/en#experimentaltoplevelawait
    experimentalTopLevelAwait: true,
  })

  server.stop()

  return result
}
