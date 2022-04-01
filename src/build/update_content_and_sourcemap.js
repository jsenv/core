import { composeTwoSourcemaps } from "@jsenv/utils/sourcemap/sourcemap_composition_v3.js"
import {
  sourcemapComment,
  sourcemapToBase64Url,
} from "@jsenv/utils/sourcemap/sourcemap_utils.js"

export const updateContentAndSourcemap = async (
  urlInfo,
  { rootDirectoryUrl, content, sourcemap },
) => {
  urlInfo.content = content
  if (urlInfo.sourcemap) {
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
