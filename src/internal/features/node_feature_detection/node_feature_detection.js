import { detectNode } from "@jsenv/core/src/internal/node_runtime/detectNode.js"
import { fetchSource } from "@jsenv/core/src/internal/node_runtime/fetchSource.js"

import { nodeSupportsDynamicImport } from "./node_feature_detect_dynamic_import.js"
import { nodeSupportsTopLevelAwait } from "./node_feature_detect_top_level_await.js"

export const scanNodeRuntimeFeatures = async ({
  compileServerOrigin,
  jsenvDirectoryRelativeUrl,
}) => {
  const jsenvDirectoryServerUrl = `${compileServerOrigin}/${jsenvDirectoryRelativeUrl}`
  const jsenvDirectoryMetaServerUrl = new URL(
    "__jsenv_meta__.json",
    jsenvDirectoryServerUrl,
  ).href
  const { compileContext } = await fetchJson(jsenvDirectoryMetaServerUrl)
  const nodeRuntime = detectNode()
  const featuresReport = await detectSupportedFeatures({
    compileContext,
  })
  const { compileId } = await fetchJson(jsenvDirectoryMetaServerUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      runtime: nodeRuntime,
      featuresReport,
    }),
  })
  return {
    compileContext,
    runtime: nodeRuntime,
    featuresReport,
    compileId,
  }
}

const detectSupportedFeatures = async () => {
  const featuresReport = {}
  featuresReport.dynamicImport = await nodeSupportsDynamicImport()
  featuresReport.topLevelAwait = await nodeSupportsTopLevelAwait()
  // Jsenv enable some features because they are standard and we can expect code to use them.
  // At the time of writing this, these features are not available in latest Node.js.
  // Some feature are also browser specific.
  // To avoid compiling code for Node.js these feaure are marked as supported.
  // It means code written to be executed in Node.js should not use these features
  // because jsenv ignore them (it won't try to "polyfill" them)
  featuresReport.module = true
  featuresReport.importmap = true
  featuresReport.import_assertions_type_json = true
  featuresReport.import_assertions_type_css = true
  featuresReport.newStylesheet = true
  featuresReport.worker_type_module = true
  featuresReport.worker_importmap = true
  return featuresReport
}

const fetchJson = async (url, options) => {
  const response = await fetchSource(url, options)
  const status = response.status
  if (status !== 200) {
    throw new Error(`unexpected response status for ${url}, got ${status}`)
  }
  const object = await response.json()
  return object
}
