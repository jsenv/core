import {
  generateGroupDescription,
  groupDescriptionToCompileDescription,
} from "../group-description/index.js"
import { generateEntryPointsForPlatform } from "./generateEntryPointsForPlatform.js"
import { generateEntryPointsFoldersForPlatform } from "./generateEntryPointsFoldersForPlatform.js"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../cancellationHelper.js"

export const bundlePlatform = catchAsyncFunctionCancellation(
  async ({
    entryPointsDescription,
    projectFolder,
    into,
    babelPluginDescription,
    compileGroupCount = 2,
    platformScoring,
    genereateBalancerFilesForPlatform,
  }) => {
    if (typeof projectFolder !== "string")
      throw new TypeError(`bundleBrowser root must be a string, got ${projectFolder}`)
    if (typeof into !== "string")
      throw new TypeError(`bundleBrowser into must be a string, got ${into}`)
    if (typeof entryPointsDescription !== "object")
      throw new TypeError(
        `bundleBrowser entryPointsDescription must be an object, got ${entryPointsDescription}`,
      )
    if (compileGroupCount < 1)
      throw new Error(`bundleBrowser compileGroupCount must be > 1, got ${compileGroupCount}`)

    const cancellationToken = createProcessInterruptionCancellationToken()

    // https://rollupjs.org/guide/en#output-format
    const rollupOptions = {
      format: "cjs",
      sourcemapExcludeSources: false,
    }

    if (compileGroupCount === 1) {
      await generateEntryPointsForPlatform({
        cancellationToken,
        projectFolder,
        into,
        entryPointsDescription,
        babelPluginDescription,
        rollupOptions,
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
      generateEntryPointsFoldersForPlatform({
        cancellationToken,
        projectFolder,
        into,
        entryPointsDescription,
        groupDescription,
        compileDescription,
        rollupOptions,
      }),
      genereateBalancerFilesForPlatform({
        cancellationToken,
        projectFolder,
        into,
        entryPointsDescription,
        groupDescription,
        compileDescription,
        rollupOptions,
      }),
    ])
  },
)
