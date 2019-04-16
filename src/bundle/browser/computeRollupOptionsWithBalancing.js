import { isNativeBrowserModuleBareSpecifier } from "/node_modules/@jsenv/module-resolution/src/isNativeBrowserModuleBareSpecifier.js"
import { createImportFromGlobalRollupPlugin } from "../import-from-global-rollup-plugin/index.js"
import { createJsenvRollupPlugin } from "../jsenv-rollup-plugin/index.js"

export const computeRollupOptionsWithBalancing = ({
  cancellationToken,
  projectFolder,
  importMapFilenameRelative,
  inlineSpecifierMap,
  into,
  entryPointMap,
  babelConfigMap,
  groupMap,
  compileId,
  log,
  logBundleFilePaths,
  minify,
}) => {
  const dir = `${projectFolder}/${into}/${compileId}`

  const importFromGlobalRollupPlugin = createImportFromGlobalRollupPlugin({
    platformGlobalName: "window",
  })

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    importMapFilenameRelative,
    inlineSpecifierMap,
    projectFolder,
    dir,
    featureNameArray: groupMap[compileId].incompatibleNameArray,
    babelConfigMap,
    minify,
    target: "browser",
    logBundleFilePaths,
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
      plugins: [importFromGlobalRollupPlugin, jsenvRollupPlugin],
      external: (id) => isNativeBrowserModuleBareSpecifier(id),
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
