import { applyPostCss } from "./apply_post_css.js"
import { postCssPluginUrlVisitor } from "./postcss_plugin_url_visitor.js"

export const replaceCssUrls = async ({
  sourcemaps,
  url,
  urlVisitor,
  map,
  content,
} = {}) => {
  const result = await applyPostCss({
    sourcemaps,
    plugins: [postCssPluginUrlVisitor({ urlVisitor })],
    url,
    content,
  })
  map = result.map
  content = result.content
  return {
    map,
    content,
  }
}
