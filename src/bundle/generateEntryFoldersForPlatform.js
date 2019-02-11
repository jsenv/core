import { rollup } from "rollup"
import createRollupBabelPlugin from "rollup-plugin-babel"
import { resolveImport } from "@jsenv/module-resolution"
import { compileMapToBabelPlugins } from "./compileMapToBabelPlugins.js"

export const generateEntryFoldersForPlatform = async ({
  localRoot,
  bundleInto,
  entryPointObject,
  compileMap,
  compileParamMap,
  rollupOptions,
}) => {
  await Promise.all(
    Object.keys(compileMap).map((compileId) => {
      return generateEntryFolderForPlatform({
        localRoot,
        bundleInto,
        entryPointObject,
        compileId,
        compileIdPluginMap: compileParamMap[compileId].pluginMap,
        rollupOptions,
      })
    }),
  )
}

const generateEntryFolderForPlatform = async ({
  localRoot,
  bundleInto,
  entryPointObject,
  compileId,
  compileIdPluginMap,
  rollupOptions,
}) => {
  const resolveId = (importee, importer) => {
    if (!importer) return importee
    // todo: check with an http/https import how rollup behaves with them?
    return resolveImport({
      moduleSpecifier: importee,
      file: importer,
      root: localRoot,
      useNodeModuleResolutionOnRelative: false,
      // once you have decided to bundle using jsenv
      // you must stick to jsenv module resolution
      // so that jsenv knows where to find the source file to bundle
      // because it will bundle node_modules as well
      // (to get proper babel plugin applied)
      // but won't rely on stuff like having a module inside your package.json
      useNodeModuleResolutionInsideDedicatedFolder: true,
    })
  }

  const rollupJsenvPlugin = {
    name: "jsenv",
    resolveId,
  }

  const babelPlugins = compileMapToBabelPlugins(compileIdPluginMap)

  // https://github.com/rollup/rollup-plugin-babel
  const rollupBabelPlugin = createRollupBabelPlugin({
    babelrc: false,
    plugins: babelPlugins,
    parserOpts: {
      allowAwaitOutsideFunction: true,
    },
  })

  const options = {
    input: entryPointObject,
    plugins: [rollupJsenvPlugin, rollupBabelPlugin],
    // skip rollup warnings
    onwarn: () => {},
    experimentalTopLevelAwait: true,
  }
  const rollupBundle = await rollup(options)

  const result = await rollupBundle.write({
    // https://rollupjs.org/guide/en#output-dir
    dir: `${localRoot}/${bundleInto}/${compileId}`,
    // https://rollupjs.org/guide/en#output-sourcemap
    sourcemap: true,
    sourcemapExcludeSources: true,
    // https://rollupjs.org/guide/en#experimentaltoplevelawait
    experimentalTopLevelAwait: true,
    ...rollupOptions,
  })

  return result
}
