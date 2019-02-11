import { rollup } from "rollup"
import createRollupBabelPlugin from "rollup-plugin-babel"
import { resolveImport } from "@jsenv/module-resolution"

export const bundlePlatform = async ({
  localRoot,
  bundleInto,
  entryPointObject,
  compileMap,
  compileParamMap,
  rollupOptions,
  experimentalExplicitNodeModule,
}) => {
  await Promise.all(
    Object.keys(compileMap).map((compileId) => {
      return bundlePlatformGroup({
        localRoot,
        bundleInto,
        entryPointObject,
        compileId,
        compileIdPluginMap: compileParamMap[compileId].pluginMap,
        rollupOptions,
        experimentalExplicitNodeModule,
      })
    }),
  )
}

const bundlePlatformGroup = async ({
  localRoot,
  bundleInto,
  entryPointObject,
  compileId,
  compileIdPluginMap,
  rollupOptions,
  experimentalExplicitNodeModule,
}) => {
  const resolveId = (importee, importer) => {
    if (!importer) return importee
    // todo: check with an http/https import how rollup behaves with them?
    return resolveImport({
      moduleSpecifier: importee,
      file: importer,
      root: localRoot,
      useNodeModuleResolutionOnRelative: !experimentalExplicitNodeModule,
      useNodeModuleResolutionInsideDedicatedFolder: experimentalExplicitNodeModule,
    })
  }

  const rollupJsenvPlugin = {
    name: "jsenv",
    resolveId,
  }

  const babelPlugins = Object.keys(compileIdPluginMap).map((name) => compileIdPluginMap[name])

  // https://github.com/rollup/rollup-plugin-babel
  const rollupBabelPlugin = createRollupBabelPlugin({
    babelrc: false,
    plugins: babelPlugins,
  })

  const options = {
    input: entryPointObject,
    plugins: [rollupJsenvPlugin, rollupBabelPlugin],
    // skip rollup warnings
    onwarn: () => {},
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
