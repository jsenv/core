import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { replaceCssUrls } from "@jsenv/core/src/internal/building/css/replaceCssUrls.js"
import { escapeTemplateStringSpecialCharacters } from "@jsenv/core/src/internal/escapeTemplateStringSpecialCharacters.js"
import {
  getCssSourceMappingUrl,
  setCssSourceMappingUrl,
} from "@jsenv/core/src/internal/sourceMappingURLUtils.js"

export const convertCssTextToJavascriptModule = async ({
  cssUrl,
  jsUrl,
  code,
  map,
}) => {
  const directoryUrl = resolveUrl("./", cssUrl)
  const jsDirectoryUrl = resolveUrl("./", jsUrl)
  if (directoryUrl !== jsDirectoryUrl) {
    const cssUrlReplaceResult = await replaceCssUrls({
      url: cssUrl,
      code,
      map,
      getUrlReplacementValue: ({ specifier }) => {
        const urlForCss = resolveUrl(specifier, cssUrl)
        const urlForJs = urlToRelativeUrl(urlForCss, jsUrl)
        return urlForJs
      },
    })
    code = cssUrlReplaceResult.code
    map = cssUrlReplaceResult.map
    const sourcemapUrlSpecifier = getCssSourceMappingUrl(code)
    const sourcemapUrlForCss = resolveUrl(sourcemapUrlSpecifier, cssUrl)
    const sourcemapUrlForJs = urlToRelativeUrl(sourcemapUrlForCss, jsUrl)
    code = setCssSourceMappingUrl(code, sourcemapUrlForJs)
  }

  const cssTextEscaped = escapeTemplateStringSpecialCharacters(code)

  return {
    code: `
const stylesheet = new CSSStyleSheet()

stylesheet.replaceSync(\`${cssTextEscaped}\`)

export default stylesheet`,
  }
}
