import { createJsenvRollupPlugin } from "../createJsenvRollupPlugin.js"
import { createFeatureProviderRollupPlugin } from "../createFeatureProviderRollupPlugin.js"

export const computeRollupOptionsWithoutBalancing = ({
  cancellationToken,
  importMap,
  projectFolder,
  into,
  entryPointMap,
  babelConfigMap,
  log,
  minify,
}) => {
  const dir = `${projectFolder}/${into}`

  const featureProviderRollupPlugin = createFeatureProviderRollupPlugin({
    featureNameArray: Object.keys(babelConfigMap),
    babelConfigMap,
    minify,
    target: "node",
  })

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    importMap,
    projectFolder,
  })

  log(`
bundle entry points for node without balancing.
entryPointArray: ${Object.keys(entryPointMap)}
dir: ${dir}
minify: ${minify}
`)

  const rollupPluginArray = [featureProviderRollupPlugin, jsenvRollupPlugin]

  return {
    rollupParseOptions: {
      input: entryPointMap,
      plugins: rollupPluginArray,
    },
    rollupGenerateOptions: {
      // https://rollupjs.org/guide/en#output-dir
      dir,
      // https://rollupjs.org/guide/en#output-format
      format: "cjs",
      // https://rollupjs.org/guide/en#output-sourcemap
      sourcemap: true,
      sourceMapExcludeSources: false,
    },
  }
}
