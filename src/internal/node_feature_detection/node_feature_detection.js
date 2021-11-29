import { resolveGroup } from "@jsenv/core/src/internal/runtime/resolveGroup.js"
import { detectNode } from "@jsenv/core/src/internal/node_runtime/detectNode.js"
import { computeCompileIdFromGroupId } from "@jsenv/core/src/internal/runtime/computeCompileIdFromGroupId.js"
import { nodeSupportsDynamicImport } from "@jsenv/core/src/internal/node_feature_detection/nodeSupportsDynamicImport.js"
import { nodeSupportsTopLevelAwait } from "@jsenv/core/src/internal/node_feature_detection/nodeSupportsTopLevelAwait.js"
import { fetchSource } from "@jsenv/core/src/internal/node_runtime/fetchSource.js"

export const scanNodeRuntimeFeatures = async ({
  compileServerOrigin,
  outDirectoryRelativeUrl,
  coverageHandledFromOutside = false,
}) => {
  const outDirectoryServerUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}`
  const {
    importDefaultExtension,
    customCompilerPatterns,
    compileServerGroupMap,
  } = await importJson(
    new URL("__compile_server_meta__.json", outDirectoryServerUrl),
  )

  const node = detectNode()
  const compileId = computeCompileIdFromGroupId({
    groupId: resolveGroup(node, compileServerGroupMap),
    groupMap: compileServerGroupMap,
  })
  const groupInfo = compileServerGroupMap[compileId]

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
    coverageHandledFromOutside,
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
    pluginRequiredNameArray,
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
  // CSS import assertions and constructable stylesheet are not supported by Node.js
  // but we assume they are not used for code executed in Node.js
  // Without this check code executed on Node.js would always be compiled
  // because import assertions and constructable stylesheet are enabled by default
  markPluginAsSupported("transform-import-assertions")
  markPluginAsSupported("new-stylesheet-as-jsenv-import")

  return requiredPluginNames
}
