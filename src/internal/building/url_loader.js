import { createDetailedMessage } from "@jsenv/logger"
import { urlToExtension, urlToRelativeUrl } from "@jsenv/filesystem"

import { fetchUrl as jsenvFetchUrl } from "@jsenv/core/src/internal/fetchUrl.js"
import { escapeTemplateStringSpecialCharacters } from "@jsenv/core/src/internal/escapeTemplateStringSpecialCharacters.js"
import { validateResponse } from "@jsenv/core/src/internal/response_validation.js"
import { transformJs } from "@jsenv/core/src/internal/compiling/js-compilation-service/transformJs.js"

import { fetchJavaScriptSourcemap } from "./js_sourcemap_fetcher.js"

export const createUrlLoader = ({
  asOriginalUrl,
  asProjectUrl,
  applyUrlMappings,
  urlImporterMap,
  beforeThrowingResponseValidationError,
}) => {
  const urlRedirectionMap = {}
  const urlResponseBodyMap = {}

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
        contentTypeExpected === "application/javascript" &&
        !responseValidity.contentType.isValid
      ) {
        const importerUrl = urlImporterMap[url].url
        const urlRelativeToImporter = urlToRelativeUrl(url, importerUrl)
        details.suggestion = ` use import.meta.url: new URL("${urlRelativeToImporter}", import.meta.url)`
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

  const loadUrl = async ({
    cancellationToken,
    logger,

    url,
    urlTrace,
    rollupUrl,
    // rollupModuleInfo,
    projectDirectoryUrl,
    babelPluginMap,
    asServerUrl,
    asProjectUrl,
    inlineModuleScripts,
    allowJson,
  }) => {
    // importing CSS from JS with import assertions
    if (rollupUrl.startsWith("import_type_css:")) {
      const url = asServerUrl(rollupUrl.slice("import_type_css:".length))
      // TODO: we should we use the ressource builder to fetch this url
      // so that:
      // - it knows this css exists
      // - it performs the css minification, parsing and url replacements
      const response = await fetchUrl(url, {
        cancellationToken,
        urlTrace,
        contentTypeExpected: "text/css",
      })
      const cssText = await response.text()
      const cssAsJsModule = convertCssTextToJavascriptModule(cssText)
      return {
        url: response.url,
        code: cssAsJsModule,
        map: null, // TODO: parse and fetch sourcemap from cssText
      }
    }

    if (url in inlineModuleScripts) {
      const { code, map } = await transformJs({
        code: inlineModuleScripts[url],
        url: asProjectUrl(url), // transformJs expect a file:// url
        projectDirectoryUrl,
        babelPluginMap,
        // moduleOutFormat: format // we are compiling for rollup output must be "esmodule"
      })

      return {
        url,
        code,
        map,
      }
    }

    const response = await fetchUrl(url, {
      cancellationToken,
      contentTypeExpected: [
        "application/javascript",
        ...(allowJson ? "application/json" : []),
      ],
      urlTrace,
    })

    const contentType = response.headers["content-type"]
    if (contentType === "application/javascript") {
      const jsText = await response.text()
      saveUrlResponseBody(response.url, jsText)
      const map = await fetchJavaScriptSourcemap({
        cancellationToken,
        logger,
        code: jsText,
        url,
      })
      return {
        url: response.url,
        code: jsText,
        map,
      }
    }

    // no need to check for json content-type, if it's not JS, it's JSON
    // if (contentType === "application/json") {
    // there is no need to minify the json string
    // because it becomes valid javascript
    // that will be minified by minifyJs inside renderChunk
    const jsonText = await response.text()
    saveUrlResponseBody(response.url, jsonText)
    const jsonAsJsModule = convertJsonTextToJavascriptModule(jsonText)
    return {
      url: response.url,
      code: jsonAsJsModule,
      map: null,
    }
  }

  const saveUrlResponseBody = (url, responseBodyAsText) => {
    const urlBeforeRedirection = getUrlBeforeRedirection(url)
    if (urlBeforeRedirection) {
      saveUrlResponseBody(urlBeforeRedirection, responseBodyAsText)
    }

    urlResponseBodyMap[url] = responseBodyAsText
    const projectUrl = asProjectUrl(url)
    if (projectUrl && projectUrl !== url) {
      urlResponseBodyMap[projectUrl] = responseBodyAsText
    }
  }

  const getUrlBeforeRedirection = (url) => {
    const urlBeforeRedirection = urlRedirectionMap[url]
    return urlBeforeRedirection
  }

  const getUrlResponseTextFromMemory = (url) => {
    return urlResponseBodyMap[url]
  }

  return {
    fetchUrl,
    loadUrl,
    getUrlBeforeRedirection,
    getUrlResponseTextFromMemory,
    getUrlResponseBodyMap: () => urlResponseBodyMap,
  }
}

const convertCssTextToJavascriptModule = (cssText) => {
  // should we perform CSS minification here?
  // is it already done by ressource builder or something?

  return `
const stylesheet = new CSSStyleSheet()

stylesheet.replaceSync(${escapeTemplateStringSpecialCharacters(cssText)})

export default stylesheet`
}

const convertJsonTextToJavascriptModule = (jsonText) => {
  // here we could do the following
  // return export default jsonText
  // This would return valid js, that would be minified later
  // however we will prefer using JSON.parse because it's faster
  // for js engine to parse JSON than JS

  return `export default JSON.parse(${jsonText})`
}
