/*
 * https://github.com/vitejs/vite/blob/7b95f4d8be69a92062372770cf96c3eda140c246/packages/vite/src/node/utils.ts#L534
 */

import remapping from "@ampproject/remapping"

export const composeTwoSourcemaps = (firstSourcemap, secondSourcemap) => {
  if (!firstSourcemap && !secondSourcemap) {
    return { ...nullSourceMap }
  }
  if (!firstSourcemap) {
    return secondSourcemap
  }
  if (!secondSourcemap) {
    return firstSourcemap
  }
  const map = remapping([firstSourcemap, secondSourcemap], () => null, true)
  if (!map.file) {
    delete map.file
  }
  return map
}

export const nullSourceMap = {
  names: [],
  sources: [],
  mappings: "",
  version: 3,
}
