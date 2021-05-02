import { nodeSupportsDynamicImport } from "../node-feature-detect/nodeSupportsDynamicImport.js"
import { nodeSupportsTopLevelAwait } from "../node-feature-detect/nodeSupportsTopLevelAwait.js"
import { computeCompileIdFromGroupId } from "../computeCompileIdFromGroupId.js"
import { resolveNodeGroup } from "../resolveNodeGroup.js"
import { fetchSource } from "./fetchSource.js"
import { createNodeExecutionWithSystemJs } from "./createNodeExecutionWithSystemJs.js"
import { createNodeExecutionWithDynamicImport } from "./createNodeExecutionWithDynamicImport.js"

export const createNodeRuntime = async ({
  projectDirectoryUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,
  defaultNodeModuleResolution,
}) => {
  const outDirectoryServerUrl = `${projectDirectoryUrl}${outDirectoryRelativeUrl}`
  const groupMapServerUrl = String(new URL("groupMap.json", outDirectoryServerUrl))
  const groupMap = await importJson(groupMapServerUrl)

  const compileId = computeCompileIdFromGroupId({
    groupId: resolveNodeGroup(groupMap),
    groupMap,
  })
  const groupInfo = groupMap[compileId]
  // eslint-disable-next-line no-unused-vars
  const canBypassCompilation = await nodeRuntimeSupportsAllFeatures(groupInfo)

  if (canBypassCompilation) {
    return createNodeExecutionWithDynamicImport({
      projectDirectoryUrl,
      compileServerOrigin,
    })
  }

  return createNodeExecutionWithSystemJs({
    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,
    compileId,
    defaultNodeModuleResolution,
  })
}

const importJson = async (url) => {
  const response = await fetchSource(url)
  const object = await response.json()
  return object
}

const nodeRuntimeSupportsAllFeatures = async (groupInfo) => {
  const requiredBabelPluginCount = countRequiredBabelPlugins(groupInfo)
  if (requiredBabelPluginCount > 0) {
    return false
  }

  if (groupInfo.jsenvPluginRequiredNameArray.length > 0) {
    return false
  }

  const hasDynamicImport = await nodeSupportsDynamicImport()
  if (!hasDynamicImport) {
    return false
  }

  const hasTopLevelAwait = await nodeSupportsTopLevelAwait()
  if (!hasTopLevelAwait) {
    return false
  }

  return true
}

const countRequiredBabelPlugins = (groupInfo) => {
  const { babelPluginRequiredNameArray } = groupInfo
  let count = babelPluginRequiredNameArray.length

  // https://nodejs.org/docs/latest-v15.x/api/cli.html#cli_node_v8_coverage_dir
  // instrumentation CAN be handed by process.env.NODE_V8_COVERAGE
  // "transform-instrument" becomes non mandatory
  const transformInstrumentIndex = babelPluginRequiredNameArray.indexOf("transform-instrument")
  if (transformInstrumentIndex > -1 && process.env.NODE_V8_COVERAGE) {
    count--
  }
  return count
}
