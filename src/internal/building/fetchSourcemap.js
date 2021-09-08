import { createCancellationToken } from "@jsenv/cancellation"
import { resolveUrl } from "@jsenv/filesystem"
import { createLogger, createDetailedMessage } from "@jsenv/logger"
import { dataUrlToRawData, parseDataUrl } from "@jsenv/core/src/internal/dataUrl.utils.js"
import { getJavaScriptSourceMappingUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { fetchUrl } from "@jsenv/core/src/internal/fetchUrl.js"
import { validateResponseStatusIsOk } from "@jsenv/core/src/internal/validateResponseStatusIsOk.js"

export const fetchSourcemap = async (
  jsUrl,
  jsString,
  { cancellationToken = createCancellationToken(), logger = createLogger() } = {},
) => {
  const jsSourcemapUrl = getJavaScriptSourceMappingUrl(jsString)

  if (!jsSourcemapUrl) {
    return null
  }

  if (jsSourcemapUrl.startsWith("data:")) {
    const jsSourcemapString = dataUrlToRawData(parseDataUrl(jsSourcemapUrl))
    return parseSourcemapString(jsSourcemapString, jsSourcemapUrl, `inline comment in ${jsUrl}`)
  }

  const sourcemapUrl = resolveUrl(jsSourcemapUrl, jsUrl)
  const sourcemapResponse = await fetchUrl(sourcemapUrl, {
    cancellationToken,
    ignoreHttpsError: true,
  })
  const okValidation = await validateResponseStatusIsOk(sourcemapResponse, jsUrl)

  if (!okValidation.valid) {
    logger.warn(`unexpected response for sourcemap file:
${okValidation.message}`)
    return null
  }

  // in theory we should also check sourcemapResponse content-type is correctly set
  // but not really important.
  const sourcemapBodyAsText = await sourcemapResponse.text()
  return parseSourcemapString(sourcemapBodyAsText, sourcemapUrl, jsUrl)
}

const parseSourcemapString = (sourcemapString, sourcemapUrl, importer) => {
  try {
    return JSON.parse(sourcemapString)
  } catch (e) {
    if (e.name === "SyntaxError") {
      console.error(
        createDetailedMessage(`syntax error while parsing sourcemap.`, {
          ["syntax error stack"]: e.stack,
          ["sourcemap url"]: sourcemapUrl,
          ["imported by"]: importer,
        }),
      )
      return null
    }
    throw e
  }
}
