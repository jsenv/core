import postcss from "postcss"
import { urlToFileSystemPath } from "@jsenv/util"
import { postCssUrlHashPlugin } from "./postcss-urlhash-plugin.js"

export const replaceCssUrls = async (css, cssFileUrl, urlReplacements) => {
  const result = await postcss([postCssUrlHashPlugin]).process(css, {
    from: urlToFileSystemPath(cssFileUrl),
    to: urlToFileSystemPath(cssFileUrl),
    urlReplacements,
    map: {
      inline: false,
    },
  })
  return result
}
