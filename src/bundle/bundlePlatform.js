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

    const cancellationToken = createProcessInterruptionCancellationToken()

    if (compileGroupCount === 1) {
      await bundleWithRollup({
        cancellationToken,
        ...computeRollupOptionsWithoutBalancing({ cancellationToken }),
      })
      return
    }

    const groupDescription = generateGroupDescription({
      babelPluginDescription,
      platformScoring,
      groupCount: compileGroupCount,
    })

    const compileDescription = groupDescriptionToCompileDescription(
      groupDescription,
      babelPluginDescription,
    )

    await Promise.all([
      generateEntryPointsFolders({
        cancellationToken,
        compileDescription,
        computeRollupOptionsWithBalancing,
      }),
      generateEntryPointsBalancerFiles({
        cancellationToken,
        entryPointsDescription,
        groupDescription,
        computeRollupOptionsForBalancer,
      }),
    ])
  })

const generateEntryPointsFolders = async ({
  cancellationToken,
  compileDescription,
  computeRollupOptionsWithBalancing,
}) => {
  await Promise.all(
    Object.keys(compileDescription).map((compileId) => {
      return bundleWithRollup({
        cancellationToken,
        ...computeRollupOptionsWithBalancing({
          cancellationToken,
          compileId,
        }),
      })
    }),
  )
}

const generateEntryPointsBalancerFiles = ({
  cancellationToken,
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
          ...computeRollupOptionsForBalancer({
            cancellationToken,
            groupDescription,
            entryName,
            entryFilenameRelative,
          }),
        }),
      ])
    }),
  )
}
