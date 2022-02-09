import { applyPostCss } from "./apply_post_css.js"
import { postCssPluginUrlVisitor } from "./postcss_plugin_url_visitor.js"

export const parseCssUrls = async ({
  sourcemapMethod,
  url = "file:///file.css",
  content,
}) => {
  const urlMentions = []
  await applyPostCss({
    sourcemapMethod,
    plugins: [
      postCssPluginUrlVisitor({
        urlVisitor: (urlMention) => {
          urlMentions.push(urlMention)
        },
      }),
    ],
    url,
    content,
  })
  return urlMentions
}
