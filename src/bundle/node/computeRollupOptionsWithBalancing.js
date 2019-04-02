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

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    importMap,
    projectFolder,
  })

  const featureProviderRollupPlugin = createFeatureProviderRollupPlugin({
    featureNameArray: groupMap[compileId].incompatibleNameArray,
    babelConfigMap,
    minify,
    target: "node",
  })

  log(`
bundle entry points for node with balancing.
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
      format: "cjs",
      sourcemap: true,
      sourceMapExcludeSources: false,
    },
  }
}
