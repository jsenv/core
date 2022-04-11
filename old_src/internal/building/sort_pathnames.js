import { comparePathnames } from "@jsenv/filesystem"

export const sortObjectByPathnames = (object) => {
  const objectSorted = {}
  const keysSorted = Object.keys(object).sort(comparePathnames)
  keysSorted.forEach((key) => {
    objectSorted[key] = object[key]
  })
  return objectSorted
}
