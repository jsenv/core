import { createLogger } from "@jsenv/logger"
import { resolveDirectoryUrl, fileUrlToPath } from "../../urlUtils.js"
import { createJsenvRollupPlugin } from "./createJsenvRollupPlugin/createJsenvRollupPlugin.js"
import { generateBundleUsingRollup } from "./generateBundleUsingRollup.js"
import { bundleOptionsToRollupParseOptions } from "./bundleOptionsToRollupParseOptions.js"
import { bundleOptionsToRollupGenerateOptions } from "./bundleOptionsToRollupGenerateOptions.js"

export const bundleWithBalancing = async (options) => {
  const { logLevel } = options
  const logger = createLogger({ logLevel })

  const { bundleDirectoryUrl, compileId, groupMap } = options
  const bundleDirectoryUrlWithBalancing = resolveDirectoryUrl(compileId, bundleDirectoryUrl)
  const { jsenvRollupPlugin, getExtraInfo } = await createJsenvRollupPlugin({
    ...options,
    bundleDirectoryUrl: bundleDirectoryUrlWithBalancing,
    babelPluginRequiredNameArray: groupMap[compileId].babelPluginRequiredNameArray,
    logger,
  })

  const dir = fileUrlToPath(bundleDirectoryUrlWithBalancing)

  const rollupParseOptions = {
    ...bundleOptionsToRollupParseOptions(options),
    plugins: [jsenvRollupPlugin],
  }
  const rollupGenerateOptions = {
    ...bundleOptionsToRollupGenerateOptions(options),
    dir,
  }
  logger.info(createBundleWithBalancingMessage({ options, rollupGenerateOptions }))
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

const createBundleWithBalancingMessage = ({
  options: { format, entryPointMap },
  rollupGenerateOptions: { dir },
}) => `
generating bundle with balancing.
--- format ---
${format}
--- entry point map ---
${JSON.stringify(entryPointMap, null, "  ")}
--- into ---
${dir}
`
