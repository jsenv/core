import { generateCompileMap, compileMapToCompileParamMap } from "../../server-compile/index.js"
import { generateEntryFoldersForPlatform } from "../generateEntryFoldersForPlatform.js"
import { generateBalancerFilesForBrowser } from "./generateBalancerFilesForBrowser.js"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../../cancellationHelper.js"

export const bundleBrowser = catchAsyncFunctionCancellation(
  async ({
    root,
    into = "bundle/browser", // later update this to 'dist/browser'
    entryPointsDescription = { main: "index.js" },
    globalName,
    pluginMap = {},
    pluginCompatMap,
    // https://www.statista.com/statistics/268299/most-popular-internet-browsers/
    // this source of stat is what I found in 5min
    // we could improve these default usage score using better stats
    // and keep in mind this should be updated time to time or even better
    // come from your specific audience
    usageMap = {
      chrome: {
        "71": 0.3,
        "69": 0.19,
        "0": 0.01, // it means oldest version of chrome will get a score of 0.01
      },
      firefox: {
        "61": 0.3,
      },
      edge: {
        "12": 0.1,
      },
      safari: {
        "10": 0.1,
      },
      other: 0.001,
    },
    compileGroupCount = 2,
  }) => {
    if (typeof root !== "string")
      throw new TypeError(`bundleBrowser root must be a string, got ${root}`)
    if (typeof into !== "string")
      throw new TypeError(`bundleBrowser into must be a string, got ${into}`)
    if (typeof entryPointsDescription !== "object")
      throw new TypeError(
        `bundleBrowser entryPointsDescription must be an object, got ${entryPointsDescription}`,
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
      format: "iife",
      name: globalName,
      sourcemapExcludeSources: true,
    }

    await Promise.all([
      generateEntryFoldersForPlatform({
        cancellationToken,
        root,
        into,
        entryPointsDescription,
        globalName,
        compileMap,
        compileParamMap,
        rollupOptions,
      }),
      generateBalancerFilesForBrowser({
        cancellationToken,
        root,
        into,
        entryPointsDescription,
        globalName,
        compileMap,
        compileParamMap,
        rollupOptions,
      }),
    ])
  },
)
