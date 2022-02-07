import { replaceCssUrls } from "@jsenv/core/src/internal/transform_css/replace_css_urls.js"

export const injectHmrInCssUrls = async ({ ressourceGraph, url, code }) => {
  const result = await replaceCssUrls({
    url,
    urlVisitor: ({ specifier, replace }) => {
      const urlSpecifierWithHmr = ressourceGraph.injectHmrIntoUrlSpecifier(
        specifier,
        url,
      )
      if (urlSpecifierWithHmr) {
        replace(urlSpecifierWithHmr)
      }
    },
    code,
  })
  return result.code
}
