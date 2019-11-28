import { resolveUrl } from "internal/urlUtils.js"
import { parseSourceMappingURL } from "internal/sourceMappingUrlUtils.js"
import { fetchUrl } from "internal/fetchUrl.js"
import { validateResponseStatusIsOk } from "./validateResponseStatusIsOk.js"

export const fetchSourcemap = async ({ cancellationToken, logger, moduleUrl, moduleContent }) => {
  const sourcemapParsingResult = parseSourceMappingURL(moduleContent)

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
  const sourcemapResponse = await fetchUrl(sourcemapUrl, { cancellationToken })
  const okValidation = validateResponseStatusIsOk(sourcemapResponse)

  if (!okValidation.valid) {
    logger.warn(`unexpected response for sourcemap file:
${okValidation.message}`)
    return null
  }

  // in theory we should also check response content-type
  // not really important
  return generateSourcemapFromString(sourcemapResponse.body, {
    logger,
    sourcemapUrl,
    moduleUrl,
  })
}

const generateSourcemapFromString = async (
  sourcemapString,
  { cancellationToken, logger, sourcemapUrl, moduleUrl },
) => {
  const map = parseSourcemapString(sourcemapString, { logger, sourcemapUrl, moduleUrl })

  if (!map) {
    return null
  }

  // ensure sourcesContent exists and has the source
  // so that rollup figure them and bundleToCompilationResult works
  if (!map.sourcesContent) {
    map.sourcesContent = []
  }
  await Promise.all(
    map.sources.map(async (source, index) => {
      if (typeof map.sourcesContent[index] === "string") {
        return
      }

      const sourceUrl = resolveUrl(source, sourcemapUrl)
      map.sourcesContent[index] = await fetchSource(sourceUrl, { cancellationToken, logger })
    }),
  )
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

const fetchSource = async (sourceUrl, { cancellationToken, logger }) => {
  const sourceResponse = await fetchUrl(sourceUrl, { cancellationToken })
  const okValidation = validateResponseStatusIsOk(sourceResponse)

  if (!okValidation.valid) {
    logger.warn(`unexpected response for sourcemap source file:
${okValidation.message}`)
    return null
  }

  return sourceResponse.body
}
