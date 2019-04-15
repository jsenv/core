import { isNativeBrowserModuleBareSpecifier } from "/node_modules/@jsenv/module-resolution/src/isNativeBrowserModuleBareSpecifier.js"
import { createImportFromGlobalRollupPlugin } from "../import-from-global-rollup-plugin/index.js"
import { createJsenvRollupPlugin } from "../jsenv-rollup-plugin/index.js"

export const computeRollupOptionsWithoutBalancing = ({
  cancellationToken,
  importMapFilenameRelative,
  projectFolder,
  into,
  entryPointMap,
  babelConfigMap,
  log,
  logBundleFilePaths,
  minify,
}) => {
  const dir = `${projectFolder}/${into}`

  const importFromGlobalRollupPlugin = createImportFromGlobalRollupPlugin({
    platformGlobalName: "window",
  })

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    importMapFilenameRelative,
    projectFolder,
    dir,
    featureNameArray: Object.keys(babelConfigMap),
    babelConfigMap,
    minify,
    target: "browser",
    logBundleFilePaths,
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
      plugins: [importFromGlobalRollupPlugin, jsenvRollupPlugin],
      external: (id) => isNativeBrowserModuleBareSpecifier(id),
    },
    rollupGenerateOptions: {
      // https://rollupjs.org/guide/en#output-dir
      dir,
      // https://rollupjs.org/guide/en#output-format
      format: "system",
      // entryFileNames: `./[name].js`,
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
