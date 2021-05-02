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
  // TODO: if only the codevrage instrumentation plugins exists
  // and once we collect coverage using v8,
  // we can consider it is not required

  // https://nodejs.org/docs/latest-v15.x/api/cli.html#cli_node_v8_coverage_dir

  if (Object.keys(groupInfo.babelPluginRequiredNameArray).length > 0) {
    return false
  }

  if (Object.keys(groupInfo.jsenvPluginRequiredNameArray).length > 0) {
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
