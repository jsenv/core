import { createJsenvRollupPlugin } from "./createJsenvRollupPlugin/createJsenvRollupPlugin.js"
import { generateBundleUsingRollup } from "./generateBundleUsingRollup.js"
import { bundleOptionsToRollupParseOptions } from "./bundleOptionsToRollupParseOptions.js"
import { bundleOptionsToRollupGenerateOptions } from "./bundleOptionsToRollupGenerateOptions.js"

export const bundleBalancer = async (options) => {
  const { logger } = options

  const { balancerDataAbstractSpecifier } = options

  const { importReplaceMap, groupMap } = options
  const { jsenvRollupPlugin, getExtraInfo } = await createJsenvRollupPlugin({
    ...options,
    importReplaceMap: {
      ...importReplaceMap,
      [balancerDataAbstractSpecifier]: () => `export const entryPointName = ${JSON.stringify(
        Object.keys(options.entryPointMap)[0],
      )}
  export const groupMap = ${JSON.stringify(groupMap)}`,
    },
    babelPluginRequiredNameArray: groupMap.otherwise.babelPluginRequiredNameArray,
    logger,
  })

  const rollupParseOptions = {
    ...bundleOptionsToRollupParseOptions(options),
    plugins: [jsenvRollupPlugin],
  }
  const rollupGenerateOptions = {
    ...bundleOptionsToRollupGenerateOptions(options),
    format: "iife",
    sourcemapExcludeSources: true,
  }
  logger.info(createBundleBalancerMessage({ options, rollupGenerateOptions }))
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

const createBundleBalancerMessage = ({
  options: { format, entryPointMap },
  rollupGenerateOptions: { dir },
}) => `
generating bundle balancer file.
--- format ---
${format}
--- file ---
${dir}${Object.keys(entryPointMap)[0]}.js
`
