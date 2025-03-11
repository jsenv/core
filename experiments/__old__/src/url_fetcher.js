import { createDetailedMessage } from "@jsenv/logger"
import { urlToExtension, urlToRelativeUrl } from "@jsenv/filesystem"

import { fetchUrl as jsenvFetchUrl } from "@jsenv/core/src/internal/fetching.js"
import { validateResponse } from "@jsenv/core/src/internal/response_validation.js"

export const createUrlFetcher = ({
  sourceFileFetcher,
  asOriginalUrl,
  asProjectUrl,
  applyUrlMappings,
  urlImporterMap,
  beforeThrowingResponseValidationError,
}) => {
  const urlRedirectionMap = {}

  const fetchUrl = async (
    url,
    { signal, urlTrace, contentTypeExpected, crossorigin },
  ) => {
    const urlToFetch = applyUrlMappings(url)
    const response = await jsenvFetchUrl(urlToFetch, {
      signal,
      ignoreHttpsError: true,
      credentials:
        crossorigin === "anonymous" || crossorigin === ""
          ? "same-origin"
          : crossorigin === "use-credentials"
          ? "include"
          : undefined,
    })
    const responseUrl = response.url
    const originalUrl =
      asOriginalUrl(responseUrl) || asProjectUrl(responseUrl) || responseUrl
    const responseValidity = await validateResponse(response, {
      originalUrl: sourceFileFetcher.isFileUrlForRemoteUrl(originalUrl)
        ? sourceFileFetcher.remoteUrlFromFileUrl(originalUrl)
        : originalUrl,
      urlTrace,
      contentTypeExpected,
    })
    if (!responseValidity.isValid) {
      const { message, details } = responseValidity
      if (
        responseValidity.contentType &&
        !responseValidity.contentType.isValid &&
        contentTypeExpected.includes("application/javascript")
      ) {
        const importerUrl = urlImporterMap[url].url
        const urlRelativeToImporter = `./${urlToRelativeUrl(url, importerUrl)}`
        details.suggestion = `use import.meta.url: new URL("${urlRelativeToImporter}", import.meta.url)`
        const extension = urlToExtension(url)
        if (extension === ".css") {
          details[
            "suggestion 2"
          ] = `use import assertion: import css from "${urlRelativeToImporter}" assert { type: "css" }`
        }
        if (extension === ".json") {
          details[
            "suggestion 2"
          ] = `use import assertion: import data from "${urlRelativeToImporter}" assert { type: "json" }`
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
