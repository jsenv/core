import { findLowestVersion } from "../semantic-versioning/findLowestVersion.js"

export const normalizeRuntimeSupport = (runtimeSupport) => {
  const runtimeSupportNormalized = {}

  Object.keys(runtimeSupport).forEach((runtimeName) => {
    const runtimeNameNormalized = normalizeRuntimeName(runtimeName)
    const runtimeVersion = normalizeRuntimeVersion(runtimeSupport[runtimeName])
    mergeRuntimeSupport(runtimeSupportNormalized, {
      [runtimeNameNormalized]: runtimeVersion,
    })
  })

  return runtimeSupportNormalized
}

const normalizeRuntimeName = (name) => {
  return runtimeNameMapping[name] || name
}

const runtimeNameMapping = {
  chromium: "chrome",
  webkit: "safari",
}

const normalizeRuntimeVersion = (version) => {
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

export const mergeRuntimeSupport = (runtimeSupport, childRuntimeSupport) => {
  Object.keys(childRuntimeSupport).forEach((runtimeName) => {
    const childRuntimeVersion = normalizeRuntimeVersion(
      childRuntimeSupport[runtimeName],
    )
    const childRuntimeNameNormalized = normalizeRuntimeName(runtimeName)
    const runtimeVersion = runtimeSupport[childRuntimeNameNormalized]
    runtimeSupport[childRuntimeNameNormalized] = runtimeVersion
      ? findLowestVersion(runtimeVersion, childRuntimeVersion)
      : childRuntimeVersion
  })
}
