import { scanNodeRuntimeFeatures } from "@jsenv/core/src/internal/node_feature_detection/node_feature_detection.js"

export const getNodeRuntimeReport = async ({
  runtime,
  compileServerId,
  compileServerOrigin,
  jsenvDirectoryRelativeUrl,
}) => {
  const cache = cacheFromParams({
    runtime,
    compileServerId,
    compileServerOrigin,
    jsenvDirectoryRelativeUrl,
  })
  const entry = cache.read()
  if (entry) {
    return entry
  }
  const nodeRuntimeFeaturesReport = await scanNodeRuntimeFeatures({
    compileServerOrigin,
    jsenvDirectoryRelativeUrl,
  })
  cache.write(nodeRuntimeFeaturesReport)
  return nodeRuntimeFeaturesReport
}

let currentCacheParams
let currentCacheValue
const cacheFromParams = ({
  compileServerId,
  compileServerOrigin,
  jsenvDirectoryRelativeUrl,
}) => {
  const params = {
    compileServerId,
    compileServerOrigin,
    jsenvDirectoryRelativeUrl,
  }
  if (!currentCacheParams) {
    currentCacheParams = params
    return {
      read: () => null,
      write: (value) => {
        currentCacheValue = value
      },
    }
  }
  if (JSON.stringify(currentCacheParams) !== JSON.stringify(params)) {
    return {
      read: () => null,
      write: (value) => {
        currentCacheParams = params
        currentCacheValue = value
      },
    }
  }
  return {
    read: () => currentCacheValue,
    write: (value) => {
      currentCacheValue = value
    },
  }
}
