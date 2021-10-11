import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { replaceCssUrls } from "@jsenv/core/src/internal/building/css/replaceCssUrls.js"
import { escapeTemplateStringSpecialCharacters } from "@jsenv/core/src/internal/escapeTemplateStringSpecialCharacters.js"
import {
  getCssSourceMappingUrl,
  setCssSourceMappingUrl,
} from "@jsenv/core/src/internal/sourceMappingURLUtils.js"

export const convertCssTextToJavascriptModule = async ({
  url,
  jsUrl,
  code,
  map,
}) => {
  const directoryUrl = resolveUrl("./", url)
  const jsDirectoryUrl = resolveUrl("./", jsUrl)
  if (directoryUrl !== jsDirectoryUrl) {
    const cssUrlReplaceResult = await replaceCssUrls({
      url,
      code,
      map,
      getUrlReplacementValue: ({ specifier }) => {
        const urlForCss = resolveUrl(specifier, url)
        const urlForJs = urlToRelativeUrl(urlForCss, jsUrl)
        return urlForJs
      },
    })
    code = cssUrlReplaceResult.code
    map = cssUrlReplaceResult.map
    const sourcemapUrlSpecifier = getCssSourceMappingUrl(code)
    const sourcemapUrlForCss = resolveUrl(sourcemapUrlSpecifier, url)
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
