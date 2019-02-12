import { generateCompileMap, compileMapToCompileParamMap } from "../../server-compile/index.js"
import { generateEntryFoldersForPlatform } from "../generateEntryFoldersForPlatform.js"
import { generateBalancerFilesForNode } from "./generateBalancerFilesForNode.js"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../../cancellationHelper.js"

export const bundleNode = catchAsyncFunctionCancellation(
  async ({
    root,
    into = "bundle/node", // later update this to 'dist/node'
    entryPointsDescription = { main: "index.js" },
    pluginMap = {},
    pluginCompatMap,
    // https://nodejs.org/metrics/summaries/version/nodejs.org-access.log.csv
    usageMap = {
      "0.10": 0.02,
      "0.12": 0.01,
      4: 0.1,
      6: 0.25,
      7: 0.1,
      8: 1,
      9: 0.1,
      10: 0.5,
      11: 0.25,
    },
    compileGroupCount = 2,
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
      pluginMap,
      pluginCompatMap,
      platformUsageMap: usageMap,
      compileGroupCount,
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
