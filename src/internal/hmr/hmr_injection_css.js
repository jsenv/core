import { replaceCssUrls } from "@jsenv/core/src/internal/transform_css/replace_css_urls.js"

export const injectHmrInCssUrls = async ({ ressourceGraph, url, code }) => {
  const result = await replaceCssUrls({
    url,
    code,
    urlVisitor: ({ specifier }) => {
      const specifierWithHmr = ressourceGraph.injectHmrIntoSpecifier(
        specifier,
        url,
      )
      if (specifierWithHmr) {
        return specifierWithHmr
      }
      return null
    },
  })
  return result.code
}
