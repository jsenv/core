import { resolveFileUrl } from "../../../urlUtils.js"
import { parseSourceMappingURL } from "../../../sourceMappingUrlUtils.js"
import { fetchUrl } from "./fetchUrl.js"
import { validateResponseStatusIsOk } from "./validateResponseStatusIsOk.js"

export const fetchSourcemap = async ({ cancellationToken, logger, moduleUrl, moduleContent }) => {
  const sourcemapParsingResult = parseSourceMappingURL(moduleContent)

  if (!sourcemapParsingResult) {
    return null
  }

  if (sourcemapParsingResult.sourcemapString) {
    return parseSourcemapString({
      sourcemapString: sourcemapParsingResult.sourcemapString,
      sourcemapUrl: moduleUrl,
      moduleUrl,
      logger,
    })
  }

  const sourcemapUrl = resolveFileUrl(sourcemapParsingResult.sourcemapURL, moduleUrl)
  const sourcemapResponse = await fetchUrl(sourcemapUrl, { cancellationToken })
  const okValidation = validateResponseStatusIsOk(sourcemapResponse)

  if (!okValidation.valid) {
    logger.warn(okValidation.message)
    return null
  }

  // in theory we should also check response content-type
  // not really important

  return parseSourcemapString({
    logger,
    sourcemapString: sourcemapResponse.body,
    sourcemapUrl,
    moduleUrl,
  })
}

const parseSourcemapString = ({ logger, sourcemapString, sourcemapUrl, moduleUrl }) => {
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
