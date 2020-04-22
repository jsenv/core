import { resolveUrl, readFile, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import { COMPILE_ID_OTHERWISE } from "../CONSTANTS.js"
import { escapeRegexpSpecialCharacters } from "../escapeRegexpSpecialCharacters.js"

const EXPLORING_HTML_RELATIVE_URL = "src/internal/exploring/exploring.html"
const EXPLORING_CSS_RELATIVE_URL = "src/internal/exploring/exploring.css"
const EXPLORING_JS_RELATIVE_URL = "src/internal/exploring/exploring.js"
const SYSTEMJS_RELATIVE_URL = "src/internal/exploring/system.js"

const exploringHtmlFileUrl = resolveUrl(EXPLORING_HTML_RELATIVE_URL, jsenvCoreDirectoryUrl)
const exploringFileUrl = resolveUrl(EXPLORING_JS_RELATIVE_URL, jsenvCoreDirectoryUrl)
const exploringCssFileUrl = resolveUrl(EXPLORING_CSS_RELATIVE_URL, jsenvCoreDirectoryUrl)

export const serveExploring = async (
  request,
  {
    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,
    compileServerGroupMap,
    importMapFileRelativeUrl,
  },
) => {
  const html = await readFile(exploringHtmlFileUrl)

  const exploringFileRelativeUrl = urlToRelativeUrl(exploringFileUrl, projectDirectoryUrl)
  // use worst compileId to be sure it's compatible
  const compileId =
    COMPILE_ID_OTHERWISE in compileServerGroupMap
      ? COMPILE_ID_OTHERWISE
      : getLastKey(compileServerGroupMap)
  const compileDirectoryUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}${compileId}/`
  const exploringFileCompiledUrl = resolveUrl(exploringFileRelativeUrl, compileDirectoryUrl)

  const exploringCssRelativeUrl = urlToRelativeUrl(exploringCssFileUrl, projectDirectoryUrl)

  const replacements = {
    $STYLE_HREF: resolveUrl(exploringCssRelativeUrl, compileDirectoryUrl),
    $COMPILE_SERVER_IMPORT_MAP_SRC: resolveUrl(importMapFileRelativeUrl, compileDirectoryUrl),
    $SYSTEMJS_SCRIPT_SRC: resolveUrl(SYSTEMJS_RELATIVE_URL, compileServerOrigin),
    $JSENV_EXPLORING_FILE: JSON.stringify(exploringFileCompiledUrl),
  }
  const body = Object.keys(replacements).reduce((previous, key) => {
    const regex = new RegExp(escapeRegexpSpecialCharacters(key), "g")
    const value = replacements[key]
    return previous.replace(regex, value)
  }, html)

  return {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/html",
      "content-length": Buffer.byteLength(body),
    },
    body,
  }
}

const getLastKey = (object) => {
  const keys = Object.keys(object)
  return keys[keys.length - 1]
}
