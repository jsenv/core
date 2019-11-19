import { fileUrlToPath } from "internal/urlUtils.js"
import { createJsenvRollupPlugin } from "./createJsenvRollupPlugin/createJsenvRollupPlugin.js"
import { generateBundleUsingRollup } from "./generateBundleUsingRollup.js"

export const bundleEntryPoints = async ({
  cancellationToken,
  logger,
  projectDirectoryUrl,
  entryPointMap,
  bundleDirectoryUrl,
  importDefaultExtension,
  compileServer,
  compileDirectoryServerUrl,
  babelPluginMap,
  nativeModulePredicate,
  format,
  formatOutputOptions,
  minify,
  sourcemapExcludeSources,
  writeOnFileSystem,
}) => {
  const { jsenvRollupPlugin, getExtraInfo } = await createJsenvRollupPlugin({
    cancellationToken,
    logger,
    projectDirectoryUrl,
    entryPointMap,
    bundleDirectoryUrl,
    importDefaultExtension,
    compileServer,
    compileDirectoryServerUrl,
    babelPluginMap,
    format,
    minify,
  })
  const rollupParseOptions = {
    input: entryPointMap,
    external: (id) => nativeModulePredicate(id),
    plugins: [jsenvRollupPlugin],
  }
  const rollupGenerateOptions = {
    // https://rollupjs.org/guide/en#output-dir
    dir: fileUrlToPath(bundleDirectoryUrl),
    // https://rollupjs.org/guide/en#output-format
    format: formatToRollupFormat(format),
    // entryFileNames: `./[name].js`,
    // https://rollupjs.org/guide/en#output-sourcemap
    sourcemap: true,
    sourcemapExcludeSources,
    ...formatOutputOptions,
  }

  logger.info(`
generating bundle for entry points
--- format ---
${format}
--- entry point map ---
${JSON.stringify(entryPointMap, null, "  ")}
--- into ---
${rollupGenerateOptions.dir}
`)

  const rollupBundle = await generateBundleUsingRollup({
    cancellationToken,
    writeOnFileSystem,
    rollupParseOptions,
    rollupGenerateOptions,
  })

  return {
    rollupBundle,
    ...getExtraInfo(),
  }
}

const formatToRollupFormat = (format) => {
  if (format === "global") return "iife"
  if (format === "commonjs") return "cjs"
  if (format === "systemjs") return "system"
  throw new Error(`unexpected format, got ${format}`)
}
