import { composeTwoSourcemaps } from "@jsenv/core/src/utils/sourcemap/sourcemap_composition.js"
import { injectSourcemap } from "@jsenv/core/src/utils/sourcemap/sourcemap_injection.js"

export const updateContentAndSourcemap = (
  urlInfo,
  { content, sourcemap, sourcemapMethod },
) => {
  urlInfo.content = content
  if (sourcemap) {
    urlInfo.sourcemap = composeTwoSourcemaps(urlInfo.sourcemap, sourcemap)
    if (sourcemapMethod === "inline") {
      urlInfo.content = injectSourcemap(urlInfo, { sourcemapMethod })
    } else if (sourcemapMethod === "file") {
      urlInfo.content = injectSourcemap(urlInfo, { sourcemapMethod })
    }
  }
}
