import { createJsenvRollupPlugin } from "../createJsenvRollupPlugin.js"
import { createFeatureProviderRollupPlugin } from "../createFeatureProviderRollupPlugin.js"

export const computeRollupOptionsWithoutBalancing = ({
  cancellationToken,
  importMap,
  projectFolder,
  into,
  globalName,
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
    target: "browser",
  })

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    importMap,
    projectFolder,
  })

  log(`
bundle entry points for browser without balancing.
entryPointArray: ${Object.keys(entryPointMap)}
dir: ${dir}
minify: ${minify}
`)

  return {
    rollupParseOptions: {
      input: entryPointMap,
      plugins: [featureProviderRollupPlugin, jsenvRollupPlugin],
    },
    rollupGenerateOptions: {
      // https://rollupjs.org/guide/en#output-dir
      dir,
      // https://rollupjs.org/guide/en#output-format
      format: "iife",
      name: globalName,
      // https://rollupjs.org/guide/en#output-sourcemap
      sourcemap: true,
      // we could exclude them
      // but it's better to put them directly
      // in case source files are not reachable
      // for whatever reason
      sourcemapExcludeSources: false,
    },
  }
}
