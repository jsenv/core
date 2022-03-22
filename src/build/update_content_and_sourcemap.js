import { composeTwoSourcemaps } from "@jsenv/core/src/utils/sourcemap/sourcemap_composition.js"
import {
  sourcemapComment,
  sourcemapToBase64Url,
} from "@jsenv/core/src/utils/sourcemap/sourcemap_utils.js"

export const updateContentAndSourcemap = (
  urlInfo,
  { content, sourcemap, sourcemapMethod },
) => {
  urlInfo.content = content
  if (sourcemap) {
    urlInfo.sourcemap = composeTwoSourcemaps(urlInfo.sourcemap, sourcemap)
    urlInfo.content = sourcemapComment.write({
      contentType: urlInfo.contentType,
      content: urlInfo.content,
      specifier:
        sourcemapMethod === "inline"
          ? sourcemapToBase64Url(urlInfo.sourcemap)
          : urlInfo.sourcemapUrl,
    })
  }
}
