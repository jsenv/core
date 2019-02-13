import { browserScoring } from "../../group-description/index.js"
import { bundlePlatform } from "../bundlePlatform.js"
import { generateBalancerFilesForBrowser } from "./generateBalancerFilesForBrowser.js"

export const bundleBrowser = ({
  entryPointsDescription,
  projectFolder,
  into,
  globalName,
  babelPluginDescription,
  compileGroupCount = 2,
  platformScoring = browserScoring,
}) => {
  return bundlePlatform({
    entryPointsDescription,
    projectFolder,
    into,
    globalName,
    babelPluginDescription,
    compileGroupCount,
    platformScoring,
    generateBalancerFilesForPlatform: (options) =>
      generateBalancerFilesForBrowser({ ...options, globalName }),
  })
}
