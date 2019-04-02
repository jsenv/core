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
  verbose = false,
}) =>
  catchAsyncFunctionCancellation(async () => {
    if (typeof projectFolder !== "string")
      throw new TypeError(`bundlePlatform root must be a string, got ${projectFolder}`)
    if (typeof into !== "string")
      throw new TypeError(`bundlePlatform into must be a string, got ${into}`)
    if (typeof entryPointMap !== "object")
      throw new TypeError(`bundlePlatform entryPointMap must be an object, got ${entryPointMap}`)
    if (compileGroupCount < 1)
      throw new Error(`bundlePlatform compileGroupCount must be > 1, got ${compileGroupCount}`)

    const log = verbose ? (...args) => console.log(...args) : () => {}

    const cancellationToken = createProcessInterruptionCancellationToken()

    if (compileGroupCount === 1) {
      await bundleWithRollup({
        cancellationToken,
        log,
        ...computeRollupOptionsWithoutBalancing({ cancellationToken, log }),
      })
      return
    }

    const groupMap = generateGroupMap({
      babelConfigMap,
      platformScoreMap,
      groupCount: compileGroupCount,
    })

    await Promise.all([
      generateEntryPointsFolders({
        cancellationToken,
        log,
        groupMap,
        computeRollupOptionsWithBalancing,
      }),
      generateEntryPointsBalancerFiles({
        cancellationToken,
        log,
        entryPointMap,
        groupMap,
        computeRollupOptionsForBalancer,
      }),
    ])
  })

const generateEntryPointsFolders = async ({
  cancellationToken,
  log,
  groupMap,
  computeRollupOptionsWithBalancing,
}) => {
  await Promise.all(
    Object.keys(groupMap).map((compileId) => {
      return bundleWithRollup({
        cancellationToken,
        log,
        ...computeRollupOptionsWithBalancing({
          cancellationToken,
          log,
          groupMap,
          compileId,
        }),
      })
    }),
  )
}

const generateEntryPointsBalancerFiles = ({
  cancellationToken,
  log,
  entryPointMap,
  groupMap,
  computeRollupOptionsForBalancer,
}) => {
  return Promise.all(
    Object.keys(entryPointMap).map((entryPoint) => {
      const entryFilenameRelative = `${entryPoint}.js`

      return Promise.all([
        bundleWithRollup({
          cancellationToken,
          log,
          ...computeRollupOptionsForBalancer({
            cancellationToken,
            log,
            groupMap,
            entryPoint,
            entryFilenameRelative,
          }),
        }),
      ])
    }),
  )
}
