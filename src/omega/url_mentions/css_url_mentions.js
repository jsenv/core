/*
 * https://github.com/parcel-bundler/parcel/blob/v2/packages/transformers/css/src/CSSTransformer.js
 */

import { applyPostCss } from "@jsenv/utils/css_ast/apply_post_css.js"
import { postCssPluginUrlVisitor } from "@jsenv/utils/css_ast/postcss_plugin_url_visitor.js"
import { replaceCssUrls } from "@jsenv/utils/css_ast/replace_css_urls.js"

export const parseCssUrlMentions = async ({ url, content }) => {
  const cssUrlMentions = []
  await applyPostCss({
    sourcemaps: false,
    plugins: [
      postCssPluginUrlVisitor({
        urlVisitor: ({ type, url, specifier, urlNode }) => {
          cssUrlMentions.push({
            type: `css_${type}`,
            specifier,
            start: urlNode.sourceIndex,
            end: urlNode.sourceEndIndex,
            url,
          })
        },
      }),
    ],
    url,
    content,
  })
  return {
    urlMentions: cssUrlMentions,
    replaceUrls: async (getReplacement) => {
      // we can't use magic source because urlMention.start/end do not match the url specifier
      // const magicSource = createMagicSource({ url, content })
      // cssUrlMentions.forEach((urlMention) => {
      //   magicSource.replace({
      //     start: urlMention.start,
      //     end: urlMention.end,
      //     replacement: JSON.stringify(transformUrlMention(urlMention)),
      //   })
      // })
      // return magicSource.toContentAndSourcemap()
      const result = await replaceCssUrls({
        url,
        content,
        urlVisitor: ({ url, replace }) => {
          const cssUrlMention = cssUrlMentions.find(
            (urlMention) => urlMention.url === url,
          )
          if (cssUrlMention) {
            const replacement = getReplacement(cssUrlMention)
            if (replacement) {
              replace(replacement)
            }
          }
        },
      })
      return {
        content: result.content,
        sourcemap: result.map,
      }
    },
  }
}
