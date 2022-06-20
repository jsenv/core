import { versionIsAbove } from "./is_above.js"

export const findLowestVersion = (...values) => {
  if (values.length === 0) throw new Error(`missing argument`)
  return values.reduce((lowestVersion, value) => {
    if (versionIsAbove(lowestVersion, value)) {
      return value
    }
    return lowestVersion
  })
}
