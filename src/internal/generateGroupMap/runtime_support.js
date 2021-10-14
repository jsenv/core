import { findLowestVersion } from "../semantic-versioning/findLowestVersion.js"

export const normalizeRuntimeSupport = (runtimeSupport) => {
  const runtimeSupportNormalized = {}

  Object.keys(runtimeSupport).forEach((runtimeName) => {
    const runtimeVersion = normalizeVersion(runtimeSupport[runtimeName])
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

const normalizeVersion = (version) => {
  if (version.indexOf(".") > -1) {
    const parts = version.split(".")
    // remove extraneous .
    return parts.slice(0, 3).join(".")
  }

  if (version.indexOf("_") > -1) {
    const parts = version.split("_")
    // remove extraneous _
    return parts.slice(0, 3).join("_")
  }

  return version
}

const runtimeNameMapping = {
  chromium: "chrome",
}

export const mergeRuntimeSupport = (runtimeSupport, childRuntimeSupport) => {
  Object.keys(childRuntimeSupport).forEach((runtimeName) => {
    const runtimeVersion = runtimeSupport[runtimeName]
    const childRuntimeVersion = normalizeVersion(
      childRuntimeSupport[runtimeName],
    )
    runtimeSupport[runtimeName] = runtimeVersion
      ? findLowestVersion(runtimeVersion, childRuntimeVersion)
      : childRuntimeVersion
  })
}
