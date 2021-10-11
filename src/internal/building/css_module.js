import { resolveUrl } from "@jsenv/filesystem"

import { replaceCssUrls } from "@jsenv/core/src/internal/building/css/replaceCssUrls.js"
import { escapeTemplateStringSpecialCharacters } from "@jsenv/core/src/internal/escapeTemplateStringSpecialCharacters.js"

export const convertCssTextToJavascriptModule = async ({
  url,
  jsUrl,
  code,
  // map,
}) => {
  const directoryUrl = resolveUrl("./", url)
  const jsDirectoryUrl = resolveUrl("./", jsUrl)
  if (directoryUrl !== jsDirectoryUrl) {
    const cssUrlReplaceResult = await replaceCssUrls({
      url,
      code,
      getUrlReplacementValue: ({ url }) => {
        return url
      },
    })
    code = cssUrlReplaceResult.code
    // map = cssUrlReplaceResult.map
  }

  const cssTextEscaped = escapeTemplateStringSpecialCharacters(code)

  return `
const stylesheet = new CSSStyleSheet()

stylesheet.replaceSync(\`${cssTextEscaped}\`)

export default stylesheet`
}
