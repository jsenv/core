import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { moveCssUrls } from "@jsenv/core/src/internal/building/css/moveCssUrls.js"
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
    const moveUrlResult = await moveCssUrls({
      from: cssUrl,
      to: jsUrl,
      code,
      map,
    })
    code = moveUrlResult.code
    map = moveUrlResult.map
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
