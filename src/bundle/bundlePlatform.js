import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import { generateGroupMap } from "../group-map/index.js"
import { bundleWithRollup } from "./bundleWithRollup.js"

export const bundlePlatform = ({
  projectFolder,
  into,
  entryPointMap,
  babelConfigMap,
  compileGroupCount = 1,
  platformScoreMap,
  computeRollupOptionsWithoutBalancing,
  computeRollupOptionsWithBalancing,
  computeRollupOptionsForBalancer,
  verbose,
  logBundleFilePaths,
  writeOnFileSystem,
}) =>
  catchAsyncFunctionCancellation(async () => {
    if (typeof projectFolder !== "string")
      throw new TypeError(`projectFolder must be a string, got ${projectFolder}`)
    if (typeof into !== "string") throw new TypeError(`into must be a string, got ${into}`)
    if (typeof entryPointMap !== "object")
      throw new TypeError(`entryPointMap must be an object, got ${entryPointMap}`)
    if (compileGroupCount < 1)
      throw new Error(`compileGroupCount must be > 1, got ${compileGroupCount}`)

    const log = verbose ? (...args) => console.log(...args) : () => {}

    const cancellationToken = createProcessInterruptionCancellationToken()

    if (compileGroupCount === 1) {
      return await bundleWithRollup({
        cancellationToken,
        writeOnFileSystem,
        ...computeRollupOptionsWithoutBalancing({ cancellationToken, log, logBundleFilePaths }),
      })
    }

    const groupMap = generateGroupMap({
      babelConfigMap,
      platformScoreMap,
      groupCount: compileGroupCount,
    })

    return await Promise.all([
      generateEntryPointsFolders({
        cancellationToken,
        writeOnFileSystem,
        groupMap,
        computeRollupOptionsWithBalancing,
        log,
        logBundleFilePaths,
      }),
      generateEntryPointsBalancerFiles({
        cancellationToken,
        writeOnFileSystem,
        entryPointMap,
        groupMap,
        computeRollupOptionsForBalancer,
        log,
        logBundleFilePaths,
      }),
    ])
  })

const generateEntryPointsFolders = async ({
  cancellationToken,
  writeOnFileSystem,
  groupMap,
  computeRollupOptionsWithBalancing,
  log,
  logBundleFilePaths,
}) => {
  await Promise.all(
    Object.keys(groupMap).map((compileId) => {
      return bundleWithRollup({
        cancellationToken,
        writeOnFileSystem,
        ...computeRollupOptionsWithBalancing({
          cancellationToken,
          log,
          logBundleFilePaths,
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
  log,
  logBundleFilePaths,
}) => {
  return Promise.all(
    Object.keys(entryPointMap).map((entryPointName) => {
      return Promise.all([
        bundleWithRollup({
          cancellationToken,
          writeOnFileSystem,
          ...computeRollupOptionsForBalancer({
            cancellationToken,
            log,
            logBundleFilePaths,
            groupMap,
            entryPointName,
          }),
        }),
      ])
    }),
  )
}
