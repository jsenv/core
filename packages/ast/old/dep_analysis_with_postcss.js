import { createMagicSource } from "@jsenv/sourcemap"

import { applyPostCss } from "./apply_post_css.js"
import { postCssPluginUrlVisitor } from "./postcss_plugin_url_visitor.js"

export const parseCssUrlsUsingPostCSS = async (urlInfo, context) => {
  const cssUrls = []
  await applyPostCss({
    sourcemaps: false,
    plugins: [
      postCssPluginUrlVisitor({
        urlVisitor: ({
          type,
          specifier,
          specifierStart,
          specifierEnd,
          specifierLine,
          specifierColumn,
        }) => {
          cssUrls.push({
            type: `css_${type}`,
            specifier,
            start: specifierStart,
            end: specifierEnd,
            line: specifierLine,
            column: specifierColumn,
          })
        },
      }),
    ],
    url: urlInfo.originalUrl,
    content: urlInfo.content,
  })

  const magicSource = createMagicSource(urlInfo.content)
  for (const cssUrl of cssUrls) {
    const [reference] = context.referenceUtils.found({
      type: cssUrl.type,
      specifier: cssUrl.specifier,
      specifierStart: cssUrl.start,
      specifierEnd: cssUrl.end,
      specifierLine: cssUrl.line,
      specifierColumn: cssUrl.column,
    })
    magicSource.replace({
      start: cssUrl.start,
      end: cssUrl.end,
      replacement: await context.referenceUtils.readGeneratedSpecifier(
        reference,
      ),
    })
  }
  return magicSource.toContentAndSourcemap()
}
