import { versionIsBelow } from "./versionIsBelow.js"

export const findHighestVersion = (...values) => {
  if (values.length === 0) throw new Error(`missing argument`)

  return values.reduce((highestVersion, value) => {
    if (versionIsBelow(highestVersion, value)) {
      return value
    }
    return highestVersion
  })
}
