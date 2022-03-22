/*
 * What about https://parceljs.org/plugin-system/source-maps ?
 * see https://github.com/parcel-bundler/source-map ?
 *
 */

import parcelSourceMap from "@parcel/source-map"
import { urlToFileSystemPath } from "@jsenv/filesystem"

const SourceMap = parcelSourceMap.default

export const composeTwoSourcemaps = (
  firstSourcemap,
  secondSourcemap,
  rootDirectoryUrl,
) => {
  if (!firstSourcemap && !secondSourcemap) {
    return null
  }
  if (!firstSourcemap) {
    // secondSourcemap.sourcesContent = null
    return secondSourcemap
  }
  if (!secondSourcemap) {
    return firstSourcemap
  }
  const map = new SourceMap(urlToFileSystemPath(rootDirectoryUrl))
  map.addVLQMap(firstSourcemap)
  map.addVLQMap(secondSourcemap)
  const result = map.toVLQ()
  result.sources = result.sources.map((source) =>
    urlToFileSystemPath(new URL(source, rootDirectoryUrl).href),
  )
  // result.sourcesContent = null
  return result
}
