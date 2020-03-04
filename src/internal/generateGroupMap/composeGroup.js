import { composeRuntimeCompatMap } from "./composeRuntimeCompatMap.js"

const compositionMappingToComposeStrict = (compositionMapping, createInitial = () => ({})) => {
  const reducer = compositionMappingToStrictReducer(compositionMapping)
  return (...objects) => objects.reduce(reducer, createInitial())
}

const composeBabelPluginRequiredNameArray = (prevNameArray, nameArray) =>
  arrayWithoutDuplicate([...prevNameArray, ...nameArray]).sort()

const composeJsenvPluginRequiredNameArray = (prevNameArray, nameArray) =>
  arrayWithoutDuplicate([...prevNameArray, ...nameArray]).sort()

const arrayWithoutDuplicate = (array) =>
  array.filter((value, index) => array.indexOf(value) === index)

export const composeGroup = compositionMappingToComposeStrict(
  {
    babelPluginRequiredNameArray: composeBabelPluginRequiredNameArray,
    jsenvPluginRequiredNameArray: composeJsenvPluginRequiredNameArray,
    runtimeCompatMap: composeRuntimeCompatMap,
  },
  () => ({
    babelPluginRequiredNameArray: [],
    jsenvPluginRequiredNameArray: [],
    runtimeCompatMap: {},
  }),
)

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
