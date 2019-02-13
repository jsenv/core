import {
  generateCompileMap,
  compileMapToCompileDescription,
  browserScoring,
} from "../../compile-group/index.js"
import { generateEntryFoldersForPlatform } from "../generateEntryFoldersForPlatform.js"
import { generateBalancerFilesForBrowser } from "./generateBalancerFilesForBrowser.js"
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "../../cancellationHelper.js"

export const bundleBrowser = catchAsyncFunctionCancellation(
  async ({
    entryPointsDescription,
    projectFolder,
    into,
    globalName,
    babelPluginDescription,
    compileGroupCount = 2,
    platformScoring = browserScoring,
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

    const compileMap = generateCompileMap({
      compileGroupCount,
      babelPluginDescription,
      platformScoring,
    })

    const compileDescription = compileMapToCompileDescription(compileMap, babelPluginDescription)

    const rollupOptions = {
      format: "iife",
      name: globalName,
      sourcemapExcludeSources: true,
    }

    await Promise.all([
      generateEntryFoldersForPlatform({
        cancellationToken,
        projectFolder,
        into,
        entryPointsDescription,
        globalName,
        compileMap,
        compileDescription,
        rollupOptions,
      }),
      generateBalancerFilesForBrowser({
        cancellationToken,
        projectFolder,
        into,
        entryPointsDescription,
        globalName,
        compileMap,
        compileDescription,
        rollupOptions,
      }),
    ])
  },
)
