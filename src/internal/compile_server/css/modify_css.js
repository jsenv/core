import { parseCssUrls } from "@jsenv/core/src/internal/transform_css/parse_css_urls.js"
import { updateCssHotMetas } from "@jsenv/core/src/internal/hmr/hot_css.js"

export const modifyCss = async ({ ressourceGraph, url, content }) => {
  const urlMentions = await parseCssUrls({ url, content })
  updateCssHotMetas({
    ressourceGraph,
    url,
    urlMentions,
  })
  return { content }
}
