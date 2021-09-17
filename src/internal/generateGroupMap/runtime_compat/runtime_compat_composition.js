import { findHighestVersion } from "../../semantic-versioning/index.js"

export const composeRuntimeCompatMap = (
  runtimeCompatMap,
  secondRuntimeCompatMap,
) => {
  const composed = {}
  Object.keys(runtimeCompatMap).forEach((runtimeName) => {
    const firstVersion = String(runtimeCompatMap[runtimeName])
    composed[runtimeName] = firstVersion
  })
  Object.keys(secondRuntimeCompatMap).forEach((runtimeName) => {
    const firstVersion = composed[runtimeName]
    const secondVersion = String(secondRuntimeCompatMap[runtimeName])
    composed[runtimeName] = firstVersion
      ? findHighestVersion(firstVersion, secondVersion)
      : secondVersion
  })
  return sortObjectKeys(composed)
}

const sortObjectKeys = (object) => {
  const sorted = {}
  Object.keys(object)
    .sort()
    .forEach((key) => {
      sorted[key] = object[key]
    })
  return sorted
}

export const composeRuntimeCompat = (...runtimeCompats) => {
  return runtimeCompats.reduce(runtimeCompatComposer, {
    babelPluginRequiredNameArray: [],
    jsenvPluginRequiredNameArray: [],
    runtimeCompatMap: {},
  })
}

const compositionMappingToStrictReducer = (compositionMapping) => {
  const propertyComposeStrict = (key, previous, current) => {
    const propertyExistInCurrent = key in current
    if (!propertyExistInCurrent) return previous[key]

    const propertyExistInPrevious = key in previous
    if (!propertyExistInPrevious) return current[key]

    const composeProperty = compositionMapping[key]
    return composeProperty(previous[key], current[key])
  }

  return (previous, current) => {
    if (typeof current !== "object" || current === null) return previous

    const composed = {}
    Object.keys(compositionMapping).forEach((key) => {
      composed[key] = propertyComposeStrict(key, previous, current)
    })
    return composed
  }
}

const runtimeCompatComposer = compositionMappingToStrictReducer({
  babelPluginRequiredNameArray: (
    babelPluginNamesPrevious,
    babelPluginNamesCurrent,
  ) => {
    return arrayWithoutDuplicate([
      ...babelPluginNamesPrevious,
      ...babelPluginNamesCurrent,
    ]).sort()
  },
  jsenvPluginRequiredNameArray: (
    jsenvPluginNamesPrevious,
    jsenvPluginNamesCurrent,
  ) => {
    return arrayWithoutDuplicate([
      ...jsenvPluginNamesPrevious,
      ...jsenvPluginNamesCurrent,
    ]).sort()
  },
  runtimeCompatMap: composeRuntimeCompatMap,
})

const arrayWithoutDuplicate = (array) =>
  array.filter((value, index) => array.indexOf(value) === index)
