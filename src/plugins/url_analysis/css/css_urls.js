/*
 * https://github.com/parcel-bundler/parcel/blob/v2/packages/transformers/css/src/CSSTransformer.js
 */

import { createMagicSource, composeTwoSourcemaps } from "@jsenv/sourcemap"

export const parseAndTransformCssUrls = async (urlInfo, context) => {
  // return parseCssUrlsUsingPostCSS(urlInfo, context)
  return parseCssUrlsUsingLightningCSS(urlInfo, context)
}

const parseCssUrlsUsingPostCSS = async (urlInfo, context) => {
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

const debug = true
const parseCssUrlsUsingLightningCSS = async (urlInfo, context) => {
  const { transform } = await import("lightningcss")

  const css = urlInfo.content
  const { dependencies, code, map } = transform({
    code: Buffer.from(css),
    // see https://github.com/parcel-bundler/lightningcss/pull/25/files
    // analyzeDependencies: true,
    sourceMap: true,
  })
  const contentAfterTransform = String(code)
  const sourcemapAfterTransform = JSON.parse(String(map))

  let i = 0
  let j = Buffer.byteLength(contentAfterTransform)
  let line = 1
  let column = 0
  const magicSource = createMagicSource(String(code))
  while (i < j) {
    const char = contentAfterTransform[i]
    i++
    if (char === "\r" || char === "\n") {
      line++
      column = 0
      continue
    }
    column++
    for (const dependency of dependencies) {
      const placeholder = dependency.placeholder
      const placeholderLength = placeholder.length
      const startCandidate = i
      const endCandidate = startCandidate + placeholderLength
      let charIndex = 0
      while (startCandidate + charIndex < endCandidate) {
        const charInCss = contentAfterTransform[startCandidate + charIndex]
        const charInPlaceholder = placeholder[charIndex]
        charIndex++
        if (charInCss === charInPlaceholder) {
          continue
        } else {
          break
        }
      }
      if (charIndex === placeholderLength) {
        const start = startCandidate
        const end = endCandidate
        i = end
        const [reference] = context.referenceUtils.found({
          type: dependency.type === "url" ? "css_url" : "css_@import",
          specifier: dependency.url,
          // we could map back the original line and column using
          // the sourcemap from lightningcss but it's too poor, it does
          // not properly map back to original content
          // specifierStart: start,
          // specifierEnd: end,
          // specifierLine: line,
          // specifierColumn: column,
        })
        magicSource.replace({
          start,
          end,
          replacement: await context.referenceUtils.readGeneratedSpecifier(
            reference,
          ),
        })
      }
    }
  }

  const contentUpdated = magicSource.toContentAndSourcemap()
  const content = contentUpdated.content
  const sourcemap = composeTwoSourcemaps(
    sourcemapAfterTransform,
    contentUpdated.map,
  )
  return { content, sourcemap }
}

// const lines = css.split(/\r?\n/)
// const indexFromLine = (line) => {
//   if (line === 0) return 0
//   let index = 0
//   let i = 0
//   let j = line
//   while (i < j) {
//     index += Buffer.byteLength(lines[i])
//     i++
//   }
//   return index
// }
