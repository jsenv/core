import { createDetailedMessage } from "@jsenv/logger"
import { urlToExtension, urlToRelativeUrl } from "@jsenv/filesystem"

import { fetchUrl as jsenvFetchUrl } from "@jsenv/core/src/internal/fetchUrl.js"
import { validateResponse } from "@jsenv/core/src/internal/response_validation.js"

export const createUrlFetcher = ({
  asOriginalUrl,
  asProjectUrl,
  applyUrlMappings,
  urlImporterMap,
  beforeThrowingResponseValidationError,
}) => {
  const urlRedirectionMap = {}

  const fetchUrl = async (
    url,
    { cancellationToken, urlTrace, contentTypeExpected },
  ) => {
    const urlToFetch = applyUrlMappings(url)

    const response = await jsenvFetchUrl(urlToFetch, {
      cancellationToken,
      ignoreHttpsError: true,
    })
    const responseUrl = response.url

    const responseValidity = await validateResponse(response, {
      originalUrl:
        asOriginalUrl(responseUrl) || asProjectUrl(responseUrl) || responseUrl,
      urlTrace,
      contentTypeExpected,
    })
    if (!responseValidity.isValid) {
      const { message, details } = responseValidity
      if (
        contentTypeExpected.includes("application/javascript") &&
        !responseValidity.contentType.isValid
      ) {
        const importerUrl = urlImporterMap[url].url
        const urlRelativeToImporter = `./${urlToRelativeUrl(url, importerUrl)}`
        details.suggestion = `use import.meta.url: new URL("${urlRelativeToImporter}", import.meta.url)`
        if (urlToExtension(url) === ".css") {
          details[
            "suggestion 2"
          ] = `use import assertion: import css from "${urlRelativeToImporter}" assert { type: "css" }`
        }
      }
      const responseValidationError = new Error(
        createDetailedMessage(message, details),
      )
      beforeThrowingResponseValidationError(responseValidationError)
      throw responseValidationError
    }

    if (url !== responseUrl) {
      urlRedirectionMap[url] = responseUrl
    }

    return response
  }

  const getUrlBeforeRedirection = (url) => {
    const urlBeforeRedirection = urlRedirectionMap[url]
    return urlBeforeRedirection
  }

  return {
    fetchUrl,
    getUrlBeforeRedirection,
  }
}
