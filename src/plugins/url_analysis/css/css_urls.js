/*
 * https://github.com/parcel-bundler/parcel/blob/v2/packages/transformers/css/src/CSSTransformer.js
 */

import { createMagicSource } from "@jsenv/sourcemap"

export const parseAndTransformCssUrls = async (urlInfo, context) => {
  const cssUrls = await parseCssUrlsUsingPostCSS(urlInfo)

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

const parseCssUrlsUsingPostCSS = async (urlInfo) => {
  const { applyPostCss, postCssPluginUrlVisitor } = await import("@jsenv/ast")
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
  return cssUrls
}
