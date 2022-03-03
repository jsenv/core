import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { escapeTemplateStringSpecialCharacters } from "@jsenv/core/src/internal/template_string_escape.js"
import {
  getCssSourceMappingUrl,
  setCssSourceMappingUrl,
} from "@jsenv/core/src/internal/sourcemap_utils.js"
import { moveCssUrls } from "@jsenv/core/src/internal/transform_css/move_css_urls.js"

export const convertCssTextToJavascriptModule = async ({
  cssUrl,
  jsUrl,
  map,
  content,
}) => {
  const directoryUrl = resolveUrl("./", cssUrl)
  const jsDirectoryUrl = resolveUrl("./", jsUrl)
  if (directoryUrl !== jsDirectoryUrl) {
    const moveUrlResult = await moveCssUrls({
      from: cssUrl,
      to: jsUrl,
      map,
      content,
    })
    map = moveUrlResult.map
    content = moveUrlResult.content
    const sourcemapUrlSpecifier = getCssSourceMappingUrl(content)
    const sourcemapUrlForCss = resolveUrl(sourcemapUrlSpecifier, cssUrl)
    const sourcemapUrlForJs = urlToRelativeUrl(sourcemapUrlForCss, jsUrl)
    content = setCssSourceMappingUrl(content, sourcemapUrlForJs)
  }
  const cssTextEscaped = escapeTemplateStringSpecialCharacters(content)
  return {
    content: `
const stylesheet = new CSSStyleSheet()

stylesheet.replaceSync(\`${cssTextEscaped}\`)

export default stylesheet`,
  }
}
