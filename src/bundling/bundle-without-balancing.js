import { generateBundleUsingRollup } from "./generate-bundle-using-rollup.js"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { createImportFromGlobalRollupPlugin } from "./import-from-global-rollup-plugin/index.js"
import { createJsenvRollupPlugin } from "./jsenv-rollup-plugin/index.js"
import { createLogger } from "../logger.js"
import { formatToRollupFormat } from "./format-to-rollup-format.js"
import {
  computeSpecifierMap,
  computeSpecifierDynamicMap,
  computeBabelPluginMap,
} from "./jsenv-rollup-plugin/compute-options.js"

export const bundleWithoutBalancing = async ({
  cancellationToken,
  projectPathname,
  bundleIntoRelativePath,
  importMapRelativePath,
  importDefaultExtension,
  globalThisHelperRelativePath,
  specifierMap,
  specifierDynamicMap,
  nativeModulePredicate,
  entryPointMap,
  babelPluginMap,
  minify,
  logLevel,
  format,
  formatOutputOptions,
  writeOnFileSystem,
}) => {
  const { logTrace } = createLogger({ logLevel })

  const dir = pathnameToOperatingSystemPath(`${projectPathname}${bundleIntoRelativePath}`)
  specifierMap = {
    ...specifierMap,
    ...computeSpecifierMap(),
  }
  specifierDynamicMap = {
    ...specifierDynamicMap,
    ...computeSpecifierDynamicMap(),
  }
  babelPluginMap = computeBabelPluginMap({
    projectPathname,
    format,
    babelPluginMap,
    featureNameArray: Object.keys(babelPluginMap),
    globalThisHelperRelativePath,
  })

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    projectPathname,
    importMapRelativePath,
    importDefaultExtension,
    specifierMap,
    specifierDynamicMap,
    dir,
    babelPluginMap,
    minify,
    format,
    logLevel,
  })

  const importFromGlobalRollupPlugin = createImportFromGlobalRollupPlugin({
    platformGlobalName: "globalThis",
  })

  logTrace(`
bundle entry points without balancing.
format: ${format}
entry point names: ${Object.keys(entryPointMap)}
dir: ${dir}
minify: ${minify}
`)

  const bundle = await generateBundleUsingRollup({
    cancellationToken,
    writeOnFileSystem,
    rollupParseOptions: {
      input: entryPointMap,
      plugins: [importFromGlobalRollupPlugin, jsenvRollupPlugin],
      external: (id) => nativeModulePredicate(id),
    },
    rollupGenerateOptions: {
      // https://rollupjs.org/guide/en#output-dir
      dir,
      // https://rollupjs.org/guide/en#output-format
      format: formatToRollupFormat(format),
      // entryFileNames: `./[name].js`,
      // https://rollupjs.org/guide/en#output-sourcemap
      sourcemap: true,
      // we could exclude them
      // but it's better to put them directly
      // in case source files are not reachable
      // for whatever reason
      sourcemapExcludeSources: true,
      ...formatOutputOptions,
    },
  })

  return { bundle, relativePathAbstractArray: Object.keys(specifierDynamicMap) }
}
