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

export const bundleWithBalancing = async ({
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
  groupMap,
  compileId,
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
    featureNameArray: groupMap[compileId].incompatibleNameArray,
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
  bundle entry points with balancing.
  format: ${format}
  compileId: ${compileId}
  entryPointArray: ${Object.keys(entryPointMap)}
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
      dir,
      format: formatToRollupFormat(format),
      sourcemap: true,
      sourceMapExcludeSources: true,
      ...formatOutputOptions,
    },
  })

  return { bundle }
}
