import { fileUrlToPath } from "internal/urlUtils.js"
import { createJsenvRollupPlugin } from "./createJsenvRollupPlugin/createJsenvRollupPlugin.js"
import { generateBundleUsingRollup } from "./generateBundleUsingRollup.js"

export const bundleEntryPoints = async ({
  cancellationToken,
  logger,
  entryPointMap,
  bundleDirectoryUrl,
  nativeModulePredicate,
  sourcemapExcludeSources,
  format,
  formatOutputOptions,
  writeOnFileSystem,
  ...rest
}) => {
  const { jsenvRollupPlugin, getExtraInfo } = await createJsenvRollupPlugin({
    logger,
    entryPointMap,
    ...rest,
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
    // we could exclude them
    // but it's better to put them directly
    // in case source files are not reachable
    // for whatever reason
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
