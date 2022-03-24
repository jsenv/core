import { composeTwoSourcemaps } from "@jsenv/core/src/utils/sourcemap/sourcemap_composition_v3.js"
import {
  sourcemapComment,
  sourcemapToBase64Url,
} from "@jsenv/core/src/utils/sourcemap/sourcemap_utils.js"

export const updateContentAndSourcemap = async (
  urlInfo,
  { content, sourcemap, rootDirectoryUrl },
) => {
  urlInfo.content = content
  if (sourcemap) {
    urlInfo.sourcemap = await composeTwoSourcemaps(
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
