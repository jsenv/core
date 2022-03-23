import { composeTwoSourcemaps } from "@jsenv/core/src/utils/sourcemap/sourcemap_composition.js"
import {
  sourcemapComment,
  sourcemapToBase64Url,
} from "@jsenv/core/src/utils/sourcemap/sourcemap_utils.js"

export const updateContentAndSourcemap = (
  urlInfo,
  { content, sourcemap, rootDirectoryUrl },
) => {
  urlInfo.content = content
  if (sourcemap) {
    urlInfo.sourcemap = composeTwoSourcemaps(
      urlInfo.sourcemap,
      sourcemap,
      rootDirectoryUrl,
    )
    const specifier = sourcemapComment.read({
      contentType: urlInfo.contentType,
      content: urlInfo.content,
    }).specifier
    urlInfo.content = sourcemapComment.write({
      contentType: urlInfo.contentType,
      content: urlInfo.content,
      specifier: specifier.startsWith("data:")
        ? sourcemapToBase64Url(urlInfo.sourcemap)
        : specifier,
    })
  }
}
