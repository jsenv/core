import { fetchSource } from "@jsenv/core/src/internal/node_client/fetchSource.js"

import { nodeSupportsDynamicImport } from "./node_feature_detect_dynamic_import.js"
import { nodeSupportsTopLevelAwait } from "./node_feature_detect_top_level_await.js"

export const scanNodeRuntimeFeatures = async ({
  compileServerOrigin,
  moduleOutFormat,
  forceSource,
  forceCompilation,
  coverageHandledFromOutside,
}) => {
  const jsenvCompileProfileServerUrl = new URL(
    "__jsenv_compile_profile__",
    compileServerOrigin,
  ).href
  const { compileContext } = await fetchJson(jsenvCompileProfileServerUrl)
  const featuresReport = await detectSupportedFeatures({
    compileContext,
    coverageHandledFromOutside,
  })
  const runtimeReport = {
    env: { node: true },
    name: "node",
    version: process.version.slice(1),
    featuresReport,
    moduleOutFormat,
    forceSource,
    forceCompilation,
  }
  const { compileProfile, compileId } = await fetchJson(
    jsenvCompileProfileServerUrl,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(runtimeReport),
    },
  )
  return {
    compileProfile,
    compileId,
  }
}

const detectSupportedFeatures = async ({ coverageHandledFromOutside }) => {
  const featuresReport = {}
  // Node.js do not support http(s) imports, this information is important
  // so that we know we cannot use dynamic import
  featuresReport["import_http"] = false
  featuresReport["coverage_js"] = coverageHandledFromOutside
  featuresReport["import_dynamic"] = await nodeSupportsDynamicImport()
  featuresReport["top_level_await"] = await nodeSupportsTopLevelAwait()
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
