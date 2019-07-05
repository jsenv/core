import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { createImportFromGlobalRollupPlugin } from "./import-from-global-rollup-plugin/index.js"
import { createJsenvRollupPlugin } from "./jsenv-rollup-plugin/index.js"
import { createLogger } from "../logger.js"

export const computeRollupOptionsWithoutBalancing = ({
  cancellationToken,
  projectPathname,
  bundleIntoRelativePath,
  importMapRelativePath,
  importDefaultExtension,
  specifierMap,
  specifierDynamicMap,
  nativeModulePredicate,
  entryPointMap,
  babelPluginMap,
  format,
  formatOutputOptions,
  minify,
  logLevel,
}) => {
  const { logTrace } = createLogger({ logLevel })

  const dir = pathnameToOperatingSystemPath(`${projectPathname}${bundleIntoRelativePath}`)

  const importFromGlobalRollupPlugin = createImportFromGlobalRollupPlugin({
    platformGlobalName: "globalThis",
  })

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    projectPathname,
    importMapRelativePath,
    importDefaultExtension,
    specifierMap,
    specifierDynamicMap,
    dir,
    featureNameArray: Object.keys(babelPluginMap),
    babelPluginMap,
    minify,
    format,
    logLevel,
  })

  logTrace(`
bundle entry points without balancing.
format: ${format}
entry point names: ${Object.keys(entryPointMap)}
dir: ${dir}
minify: ${minify}
`)

  return {
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
  }
}

const formatToRollupFormat = (format) => {
  if (format === "global") return "iife"
  if (format === "commonjs") return "cjs"
  if (format === "systemjs") return "system"
  throw new Error(`unexpected format, got ${format}`)
}
