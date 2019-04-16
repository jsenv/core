import { isNativeNodeModuleBareSpecifier } from "/node_modules/@jsenv/module-resolution/src/isNativeNodeModuleBareSpecifier.js"
import { createImportFromGlobalRollupPlugin } from "../import-from-global-rollup-plugin/index.js"
import { createJsenvRollupPlugin } from "../jsenv-rollup-plugin/index.js"

export const computeRollupOptionsWithoutBalancing = ({
  cancellationToken,
  projectFolder,
  importMapFilenameRelative,
  inlineSpecifierMap,
  into,
  entryPointMap,
  babelConfigMap,
  log,
  minify,
  logBundleFilePaths,
}) => {
  const dir = `${projectFolder}/${into}`

  const importFromGlobalRollupPlugin = createImportFromGlobalRollupPlugin({
    platformGlobalName: "global",
  })

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    projectFolder,
    importMapFilenameRelative,
    inlineSpecifierMap,
    dir,
    featureNameArray: Object.keys(babelConfigMap),
    babelConfigMap,
    minify,
    target: "node",
    logBundleFilePaths,
  })

  log(`
bundle entry points for node without balancing.
dir: ${dir}
entry point names: ${Object.keys(entryPointMap)}
minify: ${minify}
`)

  return {
    rollupParseOptions: {
      input: entryPointMap,
      plugins: [importFromGlobalRollupPlugin, jsenvRollupPlugin],
      external: (id) => isNativeNodeModuleBareSpecifier(id),
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
