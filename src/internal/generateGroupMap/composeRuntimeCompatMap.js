import { findHighestVersion } from "../semantic-versioning/index.js"

export const composeRuntimeCompatMap = (runtimeCompatMap, secondRuntimeCompatMap) => {
  return objectComposeValue(
    normalizeRuntimeCompatMapVersions(runtimeCompatMap),
    normalizeRuntimeCompatMapVersions(secondRuntimeCompatMap),
    (version, secondVersion) => findHighestVersion(version, secondVersion),
  )
}

const normalizeRuntimeCompatMapVersions = (runtimeCompatibility) => {
  return objectMapValue(runtimeCompatibility, (version) => String(version))
}

const objectMapValue = (object, callback) => {
  const mapped = {}

  Object.keys(object).forEach((key) => {
    mapped[key] = callback(object[key], key, object)
  })

  return mapped
}

const objectComposeValue = (previous, object, callback) => {
  const composed = { ...previous }

  Object.keys(object).forEach((key) => {
    composed[key] = key in composed ? callback(composed[key], object[key]) : object[key]
  })

  return composed
}
