import { createCancellationToken } from "@jsenv/cancellation"
import { resolveUrl } from "@jsenv/filesystem"
import { createLogger, createDetailedMessage } from "@jsenv/logger"

import {
  dataUrlToRawData,
  parseDataUrl,
} from "@jsenv/core/src/internal/dataUrl.utils.js"
import { getJavaScriptSourceMappingUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { fetchUrl } from "@jsenv/core/src/internal/fetchUrl.js"
import { validateResponse } from "@jsenv/core/src/internal/response_validation.js"

export const fetchJavaScriptSourcemap = async ({
  cancellationToken = createCancellationToken(),
  logger = createLogger(),

  code,
  url,
} = {}) => {
  const jsSourcemapUrl = getJavaScriptSourceMappingUrl(code)
  if (!jsSourcemapUrl) {
    return null
  }

  if (jsSourcemapUrl.startsWith("data:")) {
    const jsSourcemapString = dataUrlToRawData(parseDataUrl(jsSourcemapUrl))
    return parseSourcemapString(
      jsSourcemapString,
      jsSourcemapUrl,
      `inline comment in ${url}`,
    )
  }

  const sourcemapUrl = resolveUrl(jsSourcemapUrl, url)
  const sourcemapResponse = await fetchUrl(sourcemapUrl, {
    cancellationToken,
    ignoreHttpsError: true,
  })
  const { isValid, details } = await validateResponse(sourcemapResponse, {
    // we could have a better trace
    // by appending the reference found in code
    // to an existing urlTrace array
    // good enough for now
    urlTrace: url,
    contentTypeExpected: ["application/json", "application/octet-stream"],
  })
  if (!isValid) {
    logger.warn(
      createDetailedMessage(`unexpected response for sourcemap`, details),
    )
    return null
  }

  const sourcemapBodyAsText = await sourcemapResponse.text()
  return parseSourcemapString(sourcemapBodyAsText, sourcemapUrl, url)
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
