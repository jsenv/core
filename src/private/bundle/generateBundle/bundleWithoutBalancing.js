import { createLogger } from "@jsenv/logger"
import { createJsenvRollupPlugin } from "./createJsenvRollupPlugin/createJsenvRollupPlugin.js"
import { generateBundleUsingRollup } from "./generateBundleUsingRollup.js"
import { bundleOptionsToRollupParseOptions } from "./bundleOptionsToRollupParseOptions.js"
import { bundleOptionsToRollupGenerateOptions } from "./bundleOptionsToRollupGenerateOptions.js"

export const bundleWithoutBalancing = async (options) => {
  const { logLevel } = options
  const logger = createLogger({ logLevel })

  const { babelPluginMap } = options
  const { jsenvRollupPlugin, getExtraInfo } = await createJsenvRollupPlugin({
    ...options,
    babelPluginRequiredNameArray: Object.keys(babelPluginMap),
    logger,
  })

  const rollupParseOptions = {
    ...bundleOptionsToRollupParseOptions(options),
    plugins: [jsenvRollupPlugin],
  }
  const rollupGenerateOptions = bundleOptionsToRollupGenerateOptions(options)
  logger.info(createBundleWithoutBalancingMessage({ options, rollupGenerateOptions }))
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

const createBundleWithoutBalancingMessage = ({
  options: { format, entryPointMap },
  rollupGenerateOptions: { dir },
}) => `
generating bundle.
--- format ---
${format}
--- entry point map ---
${JSON.stringify(entryPointMap, null, "  ")}
--- into ---
${dir}
`
