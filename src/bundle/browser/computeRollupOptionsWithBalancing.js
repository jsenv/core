import { createJsenvRollupPlugin } from "../createJsenvRollupPlugin.js"
import { createFeatureProviderRollupPlugin } from "../createFeatureProviderRollupPlugin.js"

export const computeRollupOptionsWithBalancing = ({
  cancellationToken,
  importMap,
  projectFolder,
  into,
  entryPointMap,
  babelConfigMap,
  groupMap,
  compileId,
  log,
  minify,
}) => {
  const dir = `${projectFolder}/${into}/${compileId}`

  const featureProviderRollupPlugin = createFeatureProviderRollupPlugin({
    dir,
    featureNameArray: groupMap[compileId].incompatibleNameArray,
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
bundle entry points for browser with balancing.
compileId: ${compileId}
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
      dir,
      format: "system",
      // entryFileNames: `./${compileId}-[name].js`,
      sourcemap: true,
      sourceMapExcludeSources: true,
    },
  }
}
