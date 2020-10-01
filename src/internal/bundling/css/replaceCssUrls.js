import postcss from "postcss"
import { urlToFileSystemPath } from "@jsenv/util"
import { postCssUrlHashPlugin } from "./postcss-urlhash-plugin.js"

export const replaceCssUrls = async (css, urlReplacements, { from, to }) => {
  const result = await postcss([postCssUrlHashPlugin]).process(css, {
    from: urlToFileSystemPath(from),
    to: urlToFileSystemPath(to),
    urlReplacements,
    map: {
      inline: false,
    },
  })
  return result
}
