import { replaceCssUrls } from "@jsenv/core/src/internal/transform_css/replace_css_urls.js"

export const injectHmrInCssUrls = async ({ ressourceGraph, url, content }) => {
  const result = await replaceCssUrls({
    sourcemapMethod: null,
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
    content,
  })
  return result.content
}
