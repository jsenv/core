import { createJsenvRollupPlugin } from "./createJsenvRollupPlugin/createJsenvRollupPlugin.js"
import { generateBundleUsingRollup } from "./generateBundleUsingRollup.js"
import { bundleOptionsToRollupParseOptions } from "./bundleOptionsToRollupParseOptions.js"
import { bundleOptionsToRollupGenerateOptions } from "./bundleOptionsToRollupGenerateOptions.js"

export const bundleEntryPoints = async (options) => {
  const { logger } = options

  const { jsenvRollupPlugin, getExtraInfo } = await createJsenvRollupPlugin({
    logger,
    ...options,
  })
  const rollupParseOptions = {
    ...bundleOptionsToRollupParseOptions(options),
    plugins: [jsenvRollupPlugin],
  }
  const rollupGenerateOptions = bundleOptionsToRollupGenerateOptions(options)

  logger.info(`
generating bundle for entry points
--- format ---
${options.format}
--- entry point map ---
${JSON.stringify(options.entryPointMap, null, "  ")}
--- into ---
${rollupGenerateOptions.dir}
`)

  const { cancellationToken, writeOnFileSystem } = options
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
