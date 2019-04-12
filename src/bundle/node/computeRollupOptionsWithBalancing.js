import { isNativeNodeModuleBareSpecifier } from "/node_modules/@jsenv/module-resolution/src/isNativeNodeModuleBareSpecifier.js"
import { createImportFromGlobalRollupPlugin } from "../import-from-global-rollup-plugin/index.js"
import { createJsenvRollupPlugin } from "../jsenv-rollup-plugin/index.js"

export const computeRollupOptionsWithBalancing = ({
  cancellationToken,
  importMapFilenameRelative,
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

  const importFromGlobalRollupPlugin = createImportFromGlobalRollupPlugin({
    platformGlobalName: "global",
  })

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    importMapFilenameRelative,
    projectFolder,
    dir,
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
      plugins: [importFromGlobalRollupPlugin, jsenvRollupPlugin],
      external: (id) => isNativeNodeModuleBareSpecifier(id),
    },
    rollupGenerateOptions: {
      dir,
      format: "cjs",
      sourcemap: true,
      sourceMapExcludeSources: false,
    },
  }
}
