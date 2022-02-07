import { applyPostCss } from "./apply_post_css.js"
import { postCssPluginUrlVisitor } from "./postcss_plugin_url_visitor.js"

export const parseCssUrls = async ({ url = "file:///file.css", code }) => {
  const urlMentions = []
  await applyPostCss({
    code,
    url,
    plugins: [
      postCssPluginUrlVisitor({
        urlVisitor: (urlMention) => {
          urlMentions.push(urlMention)
        },
      }),
    ],
  })
  return urlMentions
}
