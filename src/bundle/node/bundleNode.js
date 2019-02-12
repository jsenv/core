import {
  generateCompileMap,
  compileMapToCompileParamMap,
  nodeUsageMap,
} from "../../compile-group/index.js"
import { generateEntryFoldersForPlatform } from "../generateEntryFoldersForPlatform.js"
import { generateBalancerFilesForNode } from "./generateBalancerFilesForNode.js"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../../cancellationHelper.js"

export const bundleNode = catchAsyncFunctionCancellation(
  async ({
    entryPointsDescription,
    root,
    into,
    pluginMap,
    compileGroupCount = 2,
    usageMap = nodeUsageMap,
  }) => {
    if (typeof root !== "string")
      throw new TypeError(`bundleNode root must be a string, got ${root}`)
    if (typeof into !== "string")
      throw new TypeError(`bundleNode into must be a string, got ${into}`)
    if (typeof entryPointsDescription !== "object")
      throw new TypeError(
        `bundleNode entryPointsDescription must be an object, got ${entryPointsDescription}`,
      )

    const cancellationToken = createProcessInterruptionCancellationToken()

    const compileMap = generateCompileMap({
      compileGroupCount,
      pluginMap,
      platformUsageMap: usageMap,
    })

    const compileParamMap = compileMapToCompileParamMap(compileMap, pluginMap)

    const rollupOptions = {
      format: "cjs",
      sourcemapExcludeSources: false,
    }

    await Promise.all([
      generateEntryFoldersForPlatform({
        cancellationToken,
        root,
        into,
        entryPointsDescription,
        compileMap,
        compileParamMap,
        // https://rollupjs.org/guide/en#output-format
        rollupOptions,
      }),
      generateBalancerFilesForNode({
        cancellationToken,
        root,
        into,
        entryPointsDescription,
        compileMap,
        compileParamMap,
        rollupOptions,
      }),
    ])
  },
)
