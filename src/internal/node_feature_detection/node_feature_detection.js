import { detectNode } from "@jsenv/core/src/internal/node_runtime/detectNode.js"
import { nodeSupportsDynamicImport } from "@jsenv/core/src/internal/node_feature_detection/nodeSupportsDynamicImport.js"
import { nodeSupportsTopLevelAwait } from "@jsenv/core/src/internal/node_feature_detection/nodeSupportsTopLevelAwait.js"
import { fetchSource } from "@jsenv/core/src/internal/node_runtime/fetchSource.js"

export const scanNodeRuntimeFeatures = async ({
  compileServerOrigin,
  outDirectoryRelativeUrl,
  coverageHandledFromOutside = false,
}) => {
  const outDirectoryServerUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}`
  const { importDefaultExtension, customCompilerPatterns } = await importJson(
    new URL("__compile_meta__.json", outDirectoryServerUrl),
  )

  const node = detectNode()

  const featuresReport = {
    dynamicImport: undefined,
    topLevelAwait: undefined,
  }
  await detectSupportedFeatures({
    featuresReport,
  })
  const missingFeatureNames = adjustMissingFeatureNames(groupInfo, {
    featuresReport,
    coverageHandledFromOutside,
  })

  const canAvoidCompilation =
    // node native resolution will not auto add extension
    !importDefaultExtension &&
    customCompilerPatterns.length === 0 &&
    missingFeatureNames.length === 0 &&
    featuresReport.dynamicImport &&
    featuresReport.topLevelAwait

  return {
    canAvoidCompilation,
    featuresReport,
    missingFeatureNames,
    importDefaultExtension,
    node,
  }
}

const detectSupportedFeatures = async ({ featuresReport }) => {
  const dynamicImport = await nodeSupportsDynamicImport()
  featuresReport.dynamicImport = dynamicImport

  const topLevelAwait = await nodeSupportsTopLevelAwait()
  featuresReport.topLevelAwait = topLevelAwait
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

const adjustMissingFeatureNames = (
  groupInfo,
  { coverageHandledFromOutside },
) => {
  const { missingFeatureNames } = groupInfo
  const missingFeatureNamesCopy = missingFeatureNames.slice()
  const markAsSupported = (name) => {
    const index = missingFeatureNamesCopy.indexOf(name)
    if (index > -1) {
      missingFeatureNamesCopy.splice(index, 1)
    }
  }
  if (coverageHandledFromOutside) {
    markAsSupported("transform-instrument")
  }
  // Jsenv enable some features because they are standard and we can expect code to use them.
  // At the time of writing this, these features are not available in latest Node.js.
  // Some feature are also browser specific.
  // To avoid compiling code for Node.js these feaure are marked as supported.
  // It means code written to be execute in Node.js should not use these features
  // because jsenv ignore them (it won't try to "polyfill" them)
  markAsSupported("module")
  markAsSupported("importmap")
  markAsSupported("transform-import-assertions")
  markAsSupported("import_assertion_type_json")
  markAsSupported("import_assertion_type_css")
  markAsSupported("new-stylesheet-as-jsenv-import")
  markAsSupported("worker_type_module")
  markAsSupported("worker_importmap")
  return missingFeatureNamesCopy
}
