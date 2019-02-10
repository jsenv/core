import { rollup } from "rollup"
import { resolveImport } from "@jsenv/module-resolution"
import { transpiler } from "../jsCompile/transpiler.js"

export const bundlePlatform = async ({
  localRoot,
  bundleInto,
  entryPointObject,
  compileMap,
  platformType,
  compileParamMap,
}) => {
  await Promise.all(
    Object.keys(compileMap).map((compileId) => {
      return bundlePlatformGroup({
        localRoot,
        bundleInto,
        entryPointObject,
        compileId,
        platformType,
        compileIdPluginMap: compileParamMap[compileId].pluginMap,
      })
    }),
  )
}

const bundlePlatformGroup = async ({
  localRoot,
  bundleInto,
  entryPointObject,
  compileId,
  platformType,
  compileIdPluginMap,
}) => {
  const resolveId = (importee, importer) => {
    if (!importer) return importee
    // todo: check with an http/https import how rollup behaves with them?
    return resolveImport({
      moduleSpecifier: importee,
      file: importer,
      root: localRoot,
      useNodeModuleResolutionInsideDedicatedFolder: true,
    })
  }

  // https://rollupjs.org/guide/en#transform
  const transform = async (moduleCode, id) => {
    const { map, code } = await transpiler({
      localRoot,
      file: id,
      fileAbsolute: id,
      input: moduleCode,
      pluginMap: compileIdPluginMap,
      remap: true,
    })

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
  }

  const options = {
    input: entryPointObject,
    plugins: [jsenvRollupPlugin],
    // skip rollup warnings
    onwarn: () => {},
  }
  const rollupBundle = await rollup(options)

  const result = await rollupBundle.write({
    // https://rollupjs.org/guide/en#output-dir
    dir: `${localRoot}/${bundleInto}/${compileId}`,
    // https://rollupjs.org/guide/en#output-format
    format: platformType === "browser" ? "iife" : "cjs",
    // https://rollupjs.org/guide/en#output-sourcemap
    sourcemap: true,
    sourcemapExcludeSources: true,
    // https://rollupjs.org/guide/en#experimentaltoplevelawait
    experimentalTopLevelAwait: true,
  })

  return result
}
