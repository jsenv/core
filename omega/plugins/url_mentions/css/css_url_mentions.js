import { applyPostCss } from "@jsenv/core/src/internal/transform_css/apply_post_css.js"
import { postCssPluginUrlVisitor } from "@jsenv/core/src/internal/transform_css/postcss_plugin_url_visitor.js"
import { replaceCssUrls } from "@jsenv/core/src/internal/transform_css/replace_css_urls.js"

export const parseCssUrlMentions = async ({
  url = "file:///file.css",
  type,
  content,
}) => {
  if (type !== "css") {
    return null
  }
  const cssUrlMentions = []
  await applyPostCss({
    sourcemapMethod: false,
    plugins: [
      postCssPluginUrlVisitor({
        urlVisitor: ({ type, specifier, urlNode }) => {
          cssUrlMentions.push({
            type: `css_${type}`,
            specifier,
            start: urlNode.sourceIndex,
            end: urlNode.sourceEndIndex,
          })
        },
      }),
    ],
    url,
    content,
  })
  return {
    urlMentions: cssUrlMentions,
    getHotInfo: () => {
      return {
        hotAcceptSelf: false,
        // we don't know how to reload css, it can be anywhere
        // in order to reload it, an importer should self accept hot reloading
        // or if we talk about html, be in hotAcceptDependencies of html
        hotAcceptDependencies: [],
      }
    },
    transformUrlMentions: async ({ transformUrlMention }) => {
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
          const urlMention = cssUrlMentions.find(
            (urlMention) => urlMention.url === url,
          )
          replace(transformUrlMention(urlMention))
        },
      })
      return {
        content: result.content,
        sourcemap: result.map,
      }
    },
  }
}
