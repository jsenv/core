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
    bundleInto = "bundle/node", // later update this to 'dist/node'
    entryPointObject = { main: "index.js" },
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
    if (!root) throw new TypeError(`bundle expect root, got ${root}`)
    if (!bundleInto) throw new TypeError(`bundle expect bundleInto, got ${bundleInto}`)
    if (typeof entryPointObject !== "object")
      throw new TypeError(`bundle expect a entryPointObject, got ${entryPointObject}`)

    const cancellationToken = createProcessInterruptionCancellationToken()

    const localRoot = root

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
        localRoot,
        bundleInto,
        entryPointObject,
        compileMap,
        compileParamMap,
        // https://rollupjs.org/guide/en#output-format
        rollupOptions,
      }),
      generateBalancerFilesForNode({
        cancellationToken,
        localRoot,
        bundleInto,
        entryPointObject,
        compileMap,
        compileParamMap,
        rollupOptions,
      }),
    ])
  },
)
