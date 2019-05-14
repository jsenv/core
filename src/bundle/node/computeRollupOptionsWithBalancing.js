import { isNativeNodeModuleBareSpecifier } from "@jsenv/module-resolution/src/isNativeNodeModuleBareSpecifier.js"
import { createImportFromGlobalRollupPlugin } from "../import-from-global-rollup-plugin/index.js"
import { createJsenvRollupPlugin } from "../jsenv-rollup-plugin/index.js"
import { createLogger } from "../../logger.js"

export const computeRollupOptionsWithBalancing = ({
  cancellationToken,
  projectFolder,
  importMapFilenameRelative,
  inlineSpecifierMap,
  into,
  entryPointMap,
  babelConfigMap,
  groupMap,
  minify,
  logLevel,
  compileId,
}) => {
  const { logTrace } = createLogger({ logLevel })

  const dir = `${projectFolder}/${into}/${compileId}`

  const importFromGlobalRollupPlugin = createImportFromGlobalRollupPlugin({
    platformGlobalName: "global",
  })

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    projectFolder,
    importMapFilenameRelative,
    inlineSpecifierMap,
    dir,
    featureNameArray: groupMap[compileId].incompatibleNameArray,
    babelConfigMap,
    minify,
    target: "node",
    logLevel,
  })

  logTrace(`
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
