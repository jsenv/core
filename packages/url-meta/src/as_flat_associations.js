import { isPlainObject } from "./assertions.js"

export const asFlatAssociations = (associations) => {
  if (!isPlainObject(associations)) {
    throw new TypeError(
      `associations must be a plain object, got ${associations}`,
    )
  }
  const flatAssociations = {}
  Object.keys(associations).forEach((key) => {
    const valueMap = associations[key]
    if (!isPlainObject(valueMap)) {
      throw new TypeError(
        `all associations value must be objects, found "${key}": ${valueMap}`,
      )
    }
    Object.keys(valueMap).forEach((pattern) => {
      const value = valueMap[pattern]
      const previousValue = flatAssociations[pattern]
      flatAssociations[pattern] = previousValue
        ? { ...previousValue, [key]: value }
        : {
            [key]: value,
          }
    })
  })
  return flatAssociations
}
