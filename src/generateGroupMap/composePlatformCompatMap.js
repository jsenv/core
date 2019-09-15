import { findHighestVersion } from "../semantic-versioning/index.js"

export const composePlatformCompatMap = (platformCompatMap, secondPlatformCompatMap) => {
  return objectComposeValue(
    normalizePlatformCompatMapVersions(platformCompatMap),
    normalizePlatformCompatMapVersions(secondPlatformCompatMap),
    (version, secondVersion) => findHighestVersion(version, secondVersion),
  )
}

const normalizePlatformCompatMapVersions = (platformCompatibility) => {
  return objectMapValue(platformCompatibility, (version) => String(version))
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
