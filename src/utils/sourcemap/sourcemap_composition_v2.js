import { fileSystemPathToUrl } from "@jsenv/filesystem"
import SourceMap from "@parcel/source-map"

export const composeTwoSourcemaps = (
  firstSourcemap,
  secondSourcemap,
  rootDirectoryUrl,
) => {
  if (!firstSourcemap && !secondSourcemap) {
    return null
  }
  if (!firstSourcemap) {
    return secondSourcemap
  }
  if (!secondSourcemap) {
    return firstSourcemap
  }
  const map = new SourceMap(fileSystemPathToUrl(rootDirectoryUrl))
  map.addVLQMap(firstSourcemap)
  map.addVLQMap(secondSourcemap)
  return map.toVLQ()
}
