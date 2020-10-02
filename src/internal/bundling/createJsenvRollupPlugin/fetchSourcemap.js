import { resolveUrl } from "@jsenv/util"
import { getJavaScriptSourceMappingUrl } from "../../sourceMappingURLUtils.js"
import { fetchUrl } from "../../fetchUrl.js"
import { validateResponseStatusIsOk } from "../../validateResponseStatusIsOk.js"

export const fetchSourcemap = async ({ cancellationToken, logger, moduleUrl, moduleContent }) => {
  const sourcemapParsingResult = getJavaScriptSourceMappingUrl(moduleContent)

  if (!sourcemapParsingResult) {
    return null
  }

  if (sourcemapParsingResult.sourcemapString) {
    return generateSourcemapFromString(sourcemapParsingResult.sourcemapString, {
      sourcemapUrl: moduleUrl,
      moduleUrl,
      logger,
    })
  }

  const sourcemapUrl = resolveUrl(sourcemapParsingResult.sourcemapURL, moduleUrl)
  const sourcemapResponse = await fetchUrl(sourcemapUrl, {
    cancellationToken,
    ignoreHttpsError: true,
  })
  const okValidation = validateResponseStatusIsOk(sourcemapResponse)

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
    moduleUrl,
  })
}

const generateSourcemapFromString = async (
  sourcemapString,
  { logger, sourcemapUrl, moduleUrl },
) => {
  const map = parseSourcemapString(sourcemapString, { logger, sourcemapUrl, moduleUrl })

  if (!map) {
    return null
  }

  return map
}

const parseSourcemapString = (sourcemapString, { logger, sourcemapUrl, moduleUrl }) => {
  try {
    return JSON.parse(sourcemapString)
  } catch (e) {
    if (e.name === "SyntaxError") {
      if (sourcemapUrl === moduleUrl) {
        logger.error(`syntax error while parsing inlined sourcemap.
--- syntax error stack ---
${e.stack}
--- module url ---
${moduleUrl}`)
      } else {
        logger.error(
          `syntax error while parsing remote sourcemap.
--- syntax error stack ---
${e.stack}
--- sourcemap url ---
${sourcemapUrl}
--- module url ---
${moduleUrl}`,
        )
      }

      return null
    }
    throw e
  }
}
