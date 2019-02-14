import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"
import {
  generateGroupDescription,
  groupDescriptionToCompileDescription,
} from "../group-description/index.js"
import { bundleWithRollup } from "./bundleWithRollup.js"

export const bundlePlatform = ({
  projectFolder,
  into,
  entryPointsDescription,
  babelPluginDescription,
  compileGroupCount = 2,
  platformScoring,
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
    if (typeof entryPointsDescription !== "object")
      throw new TypeError(
        `bundlePlatform entryPointsDescription must be an object, got ${entryPointsDescription}`,
      )
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

    const groupDescription = generateGroupDescription({
      babelPluginDescription,
      platformScoring,
      groupCount: compileGroupCount,
    })

    await Promise.all([
      generateEntryPointsFolders({
        cancellationToken,
        log,
        groupDescription,
        computeRollupOptionsWithBalancing,
      }),
      generateEntryPointsBalancerFiles({
        cancellationToken,
        log,
        entryPointsDescription,
        groupDescription,
        computeRollupOptionsForBalancer,
      }),
    ])
  })

const generateEntryPointsFolders = async ({
  cancellationToken,
  log,
  groupDescription,
  computeRollupOptionsWithBalancing,
}) => {
  await Promise.all(
    Object.keys(groupDescription).map((compileId) => {
      return bundleWithRollup({
        cancellationToken,
        log,
        ...computeRollupOptionsWithBalancing({
          cancellationToken,
          log,
          groupDescription,
          compileId,
        }),
      })
    }),
  )
}

const generateEntryPointsBalancerFiles = ({
  cancellationToken,
  log,
  entryPointsDescription,
  groupDescription,
  computeRollupOptionsForBalancer,
}) => {
  return Promise.all(
    Object.keys(entryPointsDescription).map((entryName) => {
      const entryFilenameRelative = `${entryName}.js`

      return Promise.all([
        bundleWithRollup({
          cancellationToken,
          log,
          ...computeRollupOptionsForBalancer({
            cancellationToken,
            log,
            groupDescription,
            entryName,
            entryFilenameRelative,
          }),
        }),
      ])
    }),
  )
}
