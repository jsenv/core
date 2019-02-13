import {
  generateGroupDescription,
  groupDescriptionToCompileDescription,
  nodeScoring,
} from "../../group-description/index.js"
import { generateEntryFoldersForPlatform } from "../generateEntryFoldersForPlatform.js"
import { generateBalancerFilesForNode } from "./generateBalancerFilesForNode.js"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../../cancellationHelper.js"

export const bundleNode = catchAsyncFunctionCancellation(
  async ({
    entryPointsDescription,
    projectFolder,
    into,
    babelPluginDescription,
    compileGroupCount = 2,
    platformScoring = nodeScoring,
  }) => {
    if (typeof projectFolder !== "string")
      throw new TypeError(`bundleNode projectFolder must be a string, got ${projectFolder}`)
    if (typeof into !== "string")
      throw new TypeError(`bundleNode into must be a string, got ${into}`)
    if (typeof entryPointsDescription !== "object")
      throw new TypeError(
        `bundleNode entryPointsDescription must be an object, got ${entryPointsDescription}`,
      )
    if (compileGroupCount < 1)
      throw new Error(`bundleNode compileGroupCount must be > 1, got ${compileGroupCount}`)

    const cancellationToken = createProcessInterruptionCancellationToken()

    const groupDescription = generateGroupDescription({
      babelPluginDescription,
      platformScoring,
      groupCount: compileGroupCount,
    })

    const compileDescription = groupDescriptionToCompileDescription(
      groupDescription,
      babelPluginDescription,
    )

    const rollupOptions = {
      format: "cjs",
      sourcemapExcludeSources: false,
    }

    await Promise.all([
      generateEntryFoldersForPlatform({
        cancellationToken,
        projectFolder,
        into,
        entryPointsDescription,
        groupDescription,
        compileDescription,
        // https://rollupjs.org/guide/en#output-format
        rollupOptions,
      }),
      generateBalancerFilesForNode({
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
