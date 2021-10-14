import { detectNode } from "../detectNode/detectNode.js"
import { resolveGroup } from "../resolveGroup.js"
import { computeCompileIdFromGroupId } from "../computeCompileIdFromGroupId.js"
import { nodeSupportsDynamicImport } from "../node-feature-detect/nodeSupportsDynamicImport.js"
import { nodeSupportsTopLevelAwait } from "../node-feature-detect/nodeSupportsTopLevelAwait.js"
import { fetchSource } from "./fetchSource.js"

export const scanNodeRuntimeFeatures = async ({
  compileServerOrigin,
  outDirectoryRelativeUrl,
}) => {
  const outDirectoryServerUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}`
  const groupMapServerUrl = String(
    new URL("groupMap.json", outDirectoryServerUrl),
  )
  const envFileServerUrl = String(new URL("env.json", outDirectoryServerUrl))
  const [groupMap, envJson] = await Promise.all([
    importJson(groupMapServerUrl),
    importJson(envFileServerUrl),
  ])

  const { importDefaultExtension, customCompilerPatterns } = envJson

  const node = detectNode()
  const compileId = computeCompileIdFromGroupId({
    groupId: resolveGroup(node, groupMap),
    groupMap,
  })
  const groupInfo = groupMap[compileId]

  const featuresReport = {
    dynamicImport: undefined,
    topLevelAwait: undefined,
  }
  await detectSupportedFeatures({
    featuresReport,
    failFastOnFeatureDetection: true,
  })
  const pluginRequiredNameArray = pluginRequiredNamesFromGroupInfo(groupInfo, {
    featuresReport,
    // https://nodejs.org/docs/latest-v15.x/api/cli.html#cli_node_v8_coverage_dir
    // instrumentation CAN be handed by process.env.NODE_V8_COVERAGE
    // "transform-instrument" becomes non mandatory
    coverageHandledFromOutside: process.env.NODE_V8_COVERAGE,
  })

  const canAvoidCompilation =
    // node native resolution will not auto add extension
    !importDefaultExtension &&
    customCompilerPatterns.length === 0 &&
    pluginRequiredNameArray.length === 0 &&
    featuresReport.dynamicImport &&
    featuresReport.topLevelAwait

  return {
    canAvoidCompilation,
    featuresReport,
    compileId,
    importDefaultExtension,
    node,
  }
}

const detectSupportedFeatures = async ({
  featuresReport,
  failFastOnFeatureDetection,
}) => {
  const dynamicImport = await nodeSupportsDynamicImport()
  featuresReport.dynamicImport = dynamicImport
  if (failFastOnFeatureDetection && !dynamicImport) {
    return
  }

  const topLevelAwait = await nodeSupportsTopLevelAwait()
  featuresReport.topLevelAwait = topLevelAwait
  if (failFastOnFeatureDetection && !topLevelAwait) {
    return
  }
}

const importJson = async (url) => {
  const response = await fetchSource(url)
  const status = response.status
  if (status !== 200) {
    throw new Error(`unexpected response status for ${url}, got ${status}`)
  }
  const object = await response.json()
  return object
}

const pluginRequiredNamesFromGroupInfo = (
  groupInfo,
  { coverageHandledFromOutside },
) => {
  const { pluginRequiredNameArray } = groupInfo
  const requiredPluginNames = pluginRequiredNameArray.slice()
  const markPluginAsSupported = (name) => {
    const index = requiredPluginNames.indexOf(name)
    if (index > -1) {
      requiredPluginNames.splice(index, 1)
    }
  }

  if (coverageHandledFromOutside) {
    markPluginAsSupported("transform-instrument")
  }
  // We assume import assertions and constructable stylesheet won't be used
  // in code executed in Node.js
  // so event they are conceptually required, they are ignored
  markPluginAsSupported("transform-import-assertions")
  markPluginAsSupported("new-stylesheet-as-jsenv-import")

  return requiredPluginNames
}
