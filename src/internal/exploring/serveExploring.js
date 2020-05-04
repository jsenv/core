import { resolveUrl, readFile, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import { COMPILE_ID_OTHERWISE } from "../CONSTANTS.js"
import { escapeRegexpSpecialCharacters } from "../escapeRegexpSpecialCharacters.js"

const EXPLORING_HTML_RELATIVE_URL = "src/internal/exploring/exploring.html"
const EXPLORING_CSS_RELATIVE_URL = "src/internal/exploring/exploring.css"
const EXPLORING_JS_RELATIVE_URL = "src/internal/exploring/exploring.js"
const SYSTEMJS_RELATIVE_URL = "src/internal/exploring/system.js"

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
  const exploringHtmlFileUrl = resolveUrl(EXPLORING_HTML_RELATIVE_URL, jsenvCoreDirectoryUrl)
  const html = await readFile(exploringHtmlFileUrl)

  // use worst compileId to be sure it's compatible
  const compileId =
    COMPILE_ID_OTHERWISE in compileServerGroupMap
      ? COMPILE_ID_OTHERWISE
      : getLastKey(compileServerGroupMap)
  const compileDirectoryUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}${compileId}/`

  const jsenvDirectoryRelativeUrl = urlToRelativeUrl(projectDirectoryUrl, jsenvCoreDirectoryUrl)
  const exploringCssProjectRelativeUrl = jsenvRelativeUrlToProjectRelativeUrl(
    EXPLORING_CSS_RELATIVE_URL,
    projectDirectoryUrl,
  )
  const systemJsProjectRelativeUrl = jsenvRelativeUrlToProjectRelativeUrl(
    SYSTEMJS_RELATIVE_URL,
    projectDirectoryUrl,
  )
  const exploringJsProjectRelativeUrl = jsenvRelativeUrlToProjectRelativeUrl(
    EXPLORING_JS_RELATIVE_URL,
    projectDirectoryUrl,
  )

  const replacements = {
    $COMPILE_SERVER_ORIGIN: compileServerOrigin,
    $JSENV_DIRECTORY_RELATIVE_URL: jsenvDirectoryRelativeUrl,
    $STYLE_HREF: resolveUrl(exploringCssProjectRelativeUrl, compileDirectoryUrl),
    $COMPILE_SERVER_IMPORT_MAP_SRC: resolveUrl(importMapFileRelativeUrl, compileDirectoryUrl),
    $SYSTEMJS_SCRIPT_SRC: resolveUrl(systemJsProjectRelativeUrl, compileServerOrigin),
    $JSENV_EXPLORING_FILE: JSON.stringify(
      resolveUrl(exploringJsProjectRelativeUrl, compileDirectoryUrl),
    ),
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

const jsenvRelativeUrlToProjectRelativeUrl = (jsenvRelativeUrl, projectDirectoryUrl) => {
  const fileUrl = resolveUrl(jsenvRelativeUrl, jsenvCoreDirectoryUrl)
  const projectRelativeUrl = urlToRelativeUrl(fileUrl, projectDirectoryUrl)
  return projectRelativeUrl
}
