import { urlToRelativeUrl } from "@jsenv/filesystem"

import { applyPostCss } from "./apply_post_css.js"
import { postCssPluginUrlVisitor } from "./postcss_plugin_url_visitor.js"

export const moveCssUrls = async ({
  from,
  to,
  sourcemapMethod,
  map,
  content,
} = {}) => {
  const fromDirectoryUrl = new URL("./", from).href
  const toDirectoryUrl = new URL("./", to).href
  // same directory, nothing to do
  if (fromDirectoryUrl === toDirectoryUrl) {
    return { map, content }
  }
  const result = await applyPostCss({
    plugins: [
      postCssPluginUrlVisitor({
        urlVisitor: ({ specifier, replace }) => {
          if (specifier[0] === "#") {
            return
          }
          const url = new URL(specifier, fromDirectoryUrl).href
          const relativeUrl = urlToRelativeUrl(url, toDirectoryUrl)
          replace(relativeUrl)
        },
      }),
    ],
    url: from,
    sourcemapMethod,
    map,
    content,
  })
  map = result.map
  content = result.content
  return { map, content }
}
