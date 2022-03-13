/*
 * Keep in mind: "no sourcemap is better than wrong sourcemap"
 *
 * What about https://github.com/parcel-bundler/source-map ?
 *
 * "@ampproject/remapping"
 *   - can compose/merge sourcemap composed of a single source
 *   - cannot compose/merge sourcemap composed of multiple sources (concatenation)
 * There is a special care when first sourcemap is composed of multiples sources AND
 * one of this source is inside the second sourcemap which is composed of a single source
 * Otherwise we'll return null because "no sourcemap is better than wrong sourcemap"
 *
 * Some source code doing more or less the same thing:
 * - https://github.com/babel/babel/pull/14246/files
 * - https://github.com/vitejs/vite/blob/7b95f4d8be69a92062372770cf96c3eda140c246/packages/vite/src/node/utils.ts#L534
 * - https://github.com/vitejs/vite/blob/33f96718dc5d827612c300fb6d0258f1c040f5a1/packages/vite/src/node/utils.ts#L548
 * - https://github.com/angular/angular/blob/28393031b10f4dbefab7587c19641e49cb820785/packages/compiler-cli/src/ngtsc/sourcemaps/src/source_file.ts
 * - https://github.com/babel/babel/blob/main/packages/babel-core/src/transformation/file/merge-map.ts
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
  if (
    firstSourcemap.sources.length === 1 &&
    secondSourcemap.sources.length === 1
  ) {
    const map = remapping([firstSourcemap, secondSourcemap], () => null, {
      excludeContent: false,
    })
    return map
  }
  // first is composed by many sources and some source correspond to the second sourcemap source
  if (
    firstSourcemap.sources.length > 1 &&
    secondSourcemap.sources.length === 1 &&
    firstSourcemap.sources.some(
      (source) => source === secondSourcemap.sources[0],
    )
  ) {
    const map = remapping(
      firstSourcemap,
      (firstSourceUrl) => {
        if (secondSourcemap.source[0] === firstSourceUrl) {
          return secondSourcemap
        }
        return { ...nullSourceMap }
      },
      {
        excludeContent: false,
      },
    )
    return map
  }
  return null
}

const nullSourceMap = {
  names: [],
  sources: [],
  mappings: "",
  version: 3,
}
