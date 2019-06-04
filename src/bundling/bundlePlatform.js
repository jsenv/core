import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import { generateGroupMap } from "../group-map/index.js"
import { bundleWithRollup } from "./bundleWithRollup.js"
import { LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS } from "../logger.js"

export const bundlePlatform = ({
  projectPathname,
  bundleIntoRelativePath,
  entryPointMap,
  babelPluginMap,
  compileGroupCount = 1,
  platformScoreMap,
  computeRollupOptionsWithoutBalancing,
  computeRollupOptionsWithBalancing,
  computeRollupOptionsForBalancer,
  logLevel = LOG_LEVEL_ERRORS_WARNINGS_AND_LOGS,
  writeOnFileSystem,
}) =>
  catchAsyncFunctionCancellation(async () => {
    if (typeof projectPathname !== "string")
      throw new TypeError(`projectPathname must be a string, got ${projectPathname}`)
    if (typeof bundleIntoRelativePath !== "string")
      throw new TypeError(`bundleIntoRelativePath must be a string, got ${bundleIntoRelativePath}`)
    if (typeof entryPointMap !== "object")
      throw new TypeError(`entryPointMap must be an object, got ${entryPointMap}`)
    if (compileGroupCount < 1)
      throw new Error(`compileGroupCount must be > 1, got ${compileGroupCount}`)

    const cancellationToken = createProcessInterruptionCancellationToken()

    if (compileGroupCount === 1) {
      return await bundleWithRollup({
        cancellationToken,
        writeOnFileSystem,
        ...computeRollupOptionsWithoutBalancing({
          cancellationToken,
          logLevel,
        }),
      })
    }

    const groupMap = generateGroupMap({
      babelPluginMap,
      platformScoreMap,
      groupCount: compileGroupCount,
    })

    return await Promise.all([
      generateEntryPointsFolders({
        cancellationToken,
        writeOnFileSystem,
        groupMap,
        computeRollupOptionsWithBalancing,
        logLevel,
      }),
      generateEntryPointsBalancerFiles({
        cancellationToken,
        writeOnFileSystem,
        entryPointMap,
        groupMap,
        computeRollupOptionsForBalancer,
        logLevel,
      }),
    ])
  })

const generateEntryPointsFolders = async ({
  cancellationToken,
  writeOnFileSystem,
  groupMap,
  computeRollupOptionsWithBalancing,
  logLevel,
}) => {
  await Promise.all(
    Object.keys(groupMap).map((compileId) => {
      return bundleWithRollup({
        cancellationToken,
        writeOnFileSystem,
        ...computeRollupOptionsWithBalancing({
          cancellationToken,
          logLevel,

          groupMap,
          compileId,
        }),
      })
    }),
  )
}

const generateEntryPointsBalancerFiles = ({
  cancellationToken,
  writeOnFileSystem,
  entryPointMap,
  groupMap,
  computeRollupOptionsForBalancer,
  logLevel,
}) => {
  return Promise.all(
    Object.keys(entryPointMap).map((entryPointName) => {
      return Promise.all([
        bundleWithRollup({
          cancellationToken,
          writeOnFileSystem,
          ...computeRollupOptionsForBalancer({
            cancellationToken,
            logLevel,
            groupMap,
            entryPointName,
          }),
        }),
      ])
    }),
  )
}
