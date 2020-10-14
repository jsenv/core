import { createCancellationToken } from "@jsenv/cancellation"
import { resolveUrl } from "@jsenv/util"
import { createLogger } from "@jsenv/logger"
import { getJavaScriptSourceMappingUrl } from "../../sourceMappingURLUtils.js"
import { fetchUrl } from "../../fetchUrl.js"
import { validateResponseStatusIsOk } from "../../validateResponseStatusIsOk.js"

export const fetchSourcemap = async (
  jsUrl,
  jsString,
  { cancellationToken = createCancellationToken(), logger = createLogger() } = {},
) => {
  const sourcemapParsingResult = getJavaScriptSourceMappingUrl(jsString)

  if (!sourcemapParsingResult) {
    return null
  }

  if (sourcemapParsingResult.sourcemapString) {
    return generateSourcemapFromString(sourcemapParsingResult.sourcemapString, {
      sourcemapUrl: `${jsUrl}.map`,
      jsUrl,
      logger,
    })
  }

  const sourcemapUrl = resolveUrl(sourcemapParsingResult.sourcemapURL, jsUrl)
  const sourcemapResponse = await fetchUrl(sourcemapUrl, {
    cancellationToken,
    ignoreHttpsError: true,
  })
  const okValidation = validateResponseStatusIsOk(sourcemapResponse, jsUrl)

  if (!okValidation.valid) {
    logger.warn(`unexpected response for sourcemap file:
${okValidation.message}`)
    return null
  }

  // in theory we should also check sourcemapResponse content-type is correctly set
  // but not really important.
  const sourcemapBodyAsText = await sourcemapResponse.text()
  return generateSourcemapFromString(sourcemapBodyAsText, {
    logger,
    sourcemapUrl,
    jsUrl,
  })
}

const generateSourcemapFromString = async (sourcemapString, { logger, sourcemapUrl, jsUrl }) => {
  const map = parseSourcemapString(sourcemapString, { logger, sourcemapUrl, jsUrl })

  if (!map) {
    return null
  }

  return map
}

const parseSourcemapString = (sourcemapString, { logger, sourcemapUrl, jsUrl }) => {
  try {
    return JSON.parse(sourcemapString)
  } catch (e) {
    if (e.name === "SyntaxError") {
      if (sourcemapUrl === jsUrl) {
        logger.error(`syntax error while parsing inlined sourcemap.
--- syntax error stack ---
${e.stack}
--- js url ---
${jsUrl}`)
      } else {
        logger.error(
          `syntax error while parsing remote sourcemap.
--- syntax error stack ---
${e.stack}
--- sourcemap url ---
${sourcemapUrl}
--- js url ---
${jsUrl}`,
        )
      }

      return null
    }
    throw e
  }
}
