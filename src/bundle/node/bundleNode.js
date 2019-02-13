import { nodeScoring } from "../../group-description/index.js"
import { bundlePlatform } from "../bundlePlatform.js"
import { generateBalancerFilesForNode } from "./generateBalancerFilesForNode.js"

export const bundleNode = ({
  entryPointsDescription,
  projectFolder,
  into,
  babelPluginDescription,
  compileGroupCount = 2,
  platformScoring = nodeScoring,
}) => {
  return bundlePlatform({
    entryPointsDescription,
    projectFolder,
    into,
    babelPluginDescription,
    compileGroupCount,
    platformScoring,
    generateBalancerFilesForPlatform: generateBalancerFilesForNode,
  })
}
