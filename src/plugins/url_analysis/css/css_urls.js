/*
 * https://github.com/parcel-bundler/parcel/blob/v2/packages/transformers/css/src/CSSTransformer.js
 */

import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import { applyPostCss } from "@jsenv/utils/css_ast/apply_post_css.js"
import { postCssPluginUrlVisitor } from "@jsenv/utils/css_ast/postcss_plugin_url_visitor.js"

export const parseAndTransformCssUrls = async (urlInfo, context) => {
  const actions = []
  const magicSource = createMagicSource(urlInfo.content)
  await applyPostCss({
    sourcemaps: false,
    plugins: [
      postCssPluginUrlVisitor({
        urlVisitor: ({ type, specifier, line, column, start, end }) => {
          const [reference] = context.referenceUtils.found({
            type: `css_${type}`,
            specifier,
            specifierStart: start,
            specifierEnd: end,
            specifierLine: line,
            specifierColumn: column,
          })
          actions.push(async () => {
            magicSource.replace({
              start,
              end,
              replacement: await context.referenceUtils.readGeneratedSpecifier(
                reference,
              ),
            })
          })
        },
      }),
    ],
    url: urlInfo.data.rawUrl || urlInfo.url,
    content: urlInfo.content,
  })
  await Promise.all(actions.map((action) => action()))
  return magicSource.toContentAndSourcemap()
}
