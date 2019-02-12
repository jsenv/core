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
    rootname,
    into,
    pluginMap,
    compileGroupCount = 2,
    usageMap = nodeUsageMap,
  }) => {
    if (typeof rootname !== "string")
      throw new TypeError(`bundleNode rootname must be a string, got ${rootname}`)
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
        rootname,
        into,
        entryPointsDescription,
        compileMap,
        compileParamMap,
        // https://rollupjs.org/guide/en#output-format
        rollupOptions,
      }),
      generateBalancerFilesForNode({
        cancellationToken,
        rootname,
        into,
        entryPointsDescription,
        compileMap,
        compileParamMap,
        rollupOptions,
      }),
    ])
  },
)
