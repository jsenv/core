/*
 * https://github.com/parcel-bundler/parcel/blob/v2/packages/transformers/css/src/CSSTransformer.js
 */

import { createMagicSource } from "@jsenv/sourcemap"
import { applyPostCss, postCssPluginUrlVisitor } from "@jsenv/ast"

export const parseAndTransformCssUrls = async (urlInfo, context) => {
  const actions = []
  const magicSource = createMagicSource(urlInfo.content)
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
          const [reference] = context.referenceUtils.found({
            type: `css_${type}`,
            specifier,
            specifierStart,
            specifierEnd,
            specifierLine,
            specifierColumn,
          })
          actions.push(async () => {
            magicSource.replace({
              start: specifierStart,
              end: specifierEnd,
              replacement: await context.referenceUtils.readGeneratedSpecifier(
                reference,
              ),
            })
          })
        },
      }),
    ],
    url: urlInfo.originalUrl,
    content: urlInfo.content,
  })
  await Promise.all(actions.map((action) => action()))
  return magicSource.toContentAndSourcemap()
}
