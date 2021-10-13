import { findLowestVersion } from "../semantic-versioning/findLowestVersion.js"

export const normalizeRuntimeSupport = (runtimeSupport) => {
  const runtimeSupportNormalized = {}

  Object.keys(runtimeSupport).forEach((runtimeName) => {
    const runtimeVersion = runtimeSupport[runtimeName]
    const runtimeNameNormalized = runtimeNameMapping[runtimeName]
    if (runtimeNameNormalized) {
      mergeRuntimeSupport(runtimeSupportNormalized, {
        [runtimeNameNormalized]: runtimeVersion,
      })
    } else {
      runtimeSupportNormalized[runtimeName] = runtimeVersion
    }
  })

  return runtimeSupportNormalized
}

const runtimeNameMapping = {
  chromium: "chrome",
}

export const mergeRuntimeSupport = (runtimeSupport, childRuntimeSupport) => {
  Object.keys(childRuntimeSupport).forEach((runtimeName) => {
    const runtimeVersion = runtimeSupport[runtimeName]
    const childRuntimeVersion = childRuntimeSupport[runtimeName]
    runtimeSupport[runtimeName] = runtimeVersion
      ? findLowestVersion(runtimeVersion, childRuntimeVersion)
      : childRuntimeVersion
  })
}
