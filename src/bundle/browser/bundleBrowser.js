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
    bundleInto = "bundle/browser", // later update this to 'dist/browser'
    entryPointObject = { main: "index.js" },
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
      format: "iife",
      name: globalName,
      sourcemapExcludeSources: true,
    }

    await Promise.all([
      generateEntryFoldersForPlatform({
        cancellationToken,
        localRoot,
        bundleInto,
        entryPointObject,
        globalName,
        compileMap,
        compileParamMap,
        rollupOptions,
      }),
      generateBalancerFilesForBrowser({
        cancellationToken,
        localRoot,
        bundleInto,
        entryPointObject,
        globalName,
        compileMap,
        compileParamMap,
        rollupOptions,
      }),
    ])
  },
)
