import { scanNodeRuntimeFeatures } from "@jsenv/core/src/internal/node_feature_detection/node_feature_detection.js"

export const getNodeRuntimeReport = async ({
  runtime,
  compileServerId,
  compileServerOrigin,
  outDirectoryRelativeUrl,
  coverageHandledFromOutside,
}) => {
  const cache = cacheFromParams({
    runtime,
    compileServerId,
    compileServerOrigin,
    outDirectoryRelativeUrl,
    coverageHandledFromOutside,
  })
  const entry = cache.read()
  if (entry) {
    return entry
  }
  const nodeRuntimeFeaturesReport = await scanNodeRuntimeFeatures({
    compileServerOrigin,
    outDirectoryRelativeUrl,
    coverageHandledFromOutside,
  })
  cache.write(nodeRuntimeFeaturesReport)
  return nodeRuntimeFeaturesReport
}

let currentCacheParams
let currentCacheValue
const cacheFromParams = ({
  compileServerId,
  compileServerOrigin,
  outDirectoryRelativeUrl,
  coverageHandledFromOutside,
}) => {
  const params = {
    compileServerId,
    compileServerOrigin,
    outDirectoryRelativeUrl,
    coverageHandledFromOutside,
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
