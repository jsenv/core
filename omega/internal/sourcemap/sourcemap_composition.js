/*
 * https://github.com/vitejs/vite/blob/7b95f4d8be69a92062372770cf96c3eda140c246/packages/vite/src/node/utils.ts#L534
 */

import remapping from "@ampproject/remapping"

export const composeTwoSourcemaps = (firstSourcemap, secondSourcemap) => {
  if (!firstSourcemap && !secondSourcemap) {
    return null
  }
  if (!firstSourcemap) {
    return secondSourcemap
  }
  if (!secondSourcemap) {
    return firstSourcemap
  }
  const firstHasMultipleSources = firstSourcemap.sources.length > 1
  const secondHasMultipleSources = secondSourcemap.sources.length > 1
  // see https://github.com/babel/babel/pull/14246/files
  // and https://github.com/vitejs/vite/blob/33f96718dc5d827612c300fb6d0258f1c040f5a1/packages/vite/src/node/utils.ts#L548
  // https://github.com/angular/angular/blob/28393031b10f4dbefab7587c19641e49cb820785/packages/compiler-cli/src/ngtsc/sourcemaps/src/source_file.ts
  // https://github.com/babel/babel/blob/main/packages/babel-core/src/transformation/file/merge-map.ts
  if (firstHasMultipleSources && secondHasMultipleSources) {
    if (firstSourcemap.sources.length > secondSourcemap.sources.length) {
      return firstSourcemap
    }
    return secondSourcemap
  }
  if (firstHasMultipleSources) {
    const map = remapping(
      firstSourcemap,
      (sourceUrl) => {
        if (sourceUrl === secondSourcemap.sources[0]) {
          return secondSourcemap
        }
        return { ...nullSourceMap }
      },
      true,
    )
    return map
  }
  const map = remapping([firstSourcemap, secondSourcemap], () => null, true)
  return map
}

const nullSourceMap = {
  names: [],
  sources: [],
  mappings: "",
  version: 3,
}
