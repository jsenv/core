import { getJavaScriptSourceMappingUrl } from "@jsenv/core/src/internal/sourcemap_utils.js"

import { convertJsonTextToJavascriptModule } from "./import_assertions/json_module.js"
import { loadSourcemap } from "./sourcemap/sourcemap_loader.js"

export const createUrlLoader = ({
  urlCustomLoaders,
  allowJson,
  urlImporterMap,

  asProjectUrl,
  asOriginalUrl,

  urlFetcher,
}) => {
  const urlResponseBodyMap = {}

  const loadUrl = async (url, { signal, logger }) => {
    const customLoader = urlCustomLoaders[url]
    if (customLoader) {
      const result = await customLoader()
      return result
    }
    const response = await urlFetcher.fetchUrl(url, {
      signal,
      contentTypeExpected: [
        "application/javascript",
        ...(allowJson ? ["application/json"] : []),
      ],
      urlTrace: () => {
        const firstImporter = urlImporterMap[url]
        url = asOriginalUrl(url) || asProjectUrl(url) || url
        return createUrlTrace({
          url: firstImporter.url,
          line: firstImporter.line,
          column: firstImporter.column,
        })
      },
    })
    const contentType = response.headers["content-type"]
    if (contentType === "application/javascript") {
      const jsText = await response.text()
      saveUrlResponseBody(response.url, jsText)
      const map = await loadSourcemap({
        signal,
        logger,
        getSourceMappingUrl: getJavaScriptSourceMappingUrl,
        url,
        content: jsText,
      })
      return {
        url: response.url,
        map,
        content: jsText,
      }
    }
    // When json is referenced from js without import assertion and minify is enabled
    // you can get non-minified json (json with spaces)
    // We could fix that by removing white spaces here but that means forwarding minify
    // param and this is only possible in Node.js where minification is less (not?) important
    const jsonText = await response.text()
    saveUrlResponseBody(response.url, jsonText)
    const { content } = convertJsonTextToJavascriptModule({ code: jsonText })
    return {
      url: response.url,
      map: null,
      content,
    }
  }

  const saveUrlResponseBody = (url, responseBodyAsText) => {
    const urlBeforeRedirection = urlFetcher.getUrlBeforeRedirection(url)
    if (urlBeforeRedirection) {
      saveUrlResponseBody(urlBeforeRedirection, responseBodyAsText)
    }

    urlResponseBodyMap[url] = responseBodyAsText
    const projectUrl = asProjectUrl(url)
    if (projectUrl && projectUrl !== url) {
      urlResponseBodyMap[projectUrl] = responseBodyAsText
    }
  }

  const getUrlResponseTextFromMemory = (url) => {
    return urlResponseBodyMap[url]
  }

  const createUrlTrace = ({ url, line, column }) => {
    const trace = [
      {
        type: "entry",
        url: asOriginalUrl(url) || asProjectUrl(url) || url,
        line,
        column,
      },
    ]
    const next = (importerUrl) => {
      const previousImporter = urlImporterMap[importerUrl]
      if (!previousImporter) {
        return
      }
      trace.push({
        type: "import",
        url:
          asOriginalUrl(previousImporter.url) ||
          asProjectUrl(previousImporter.url) ||
          previousImporter.url,
        line: previousImporter.line,
        column: previousImporter.column,
      })
      next(previousImporter.url)
    }
    next(url)

    return trace
  }

  return {
    loadUrl,
    createUrlTrace,
    getUrlResponseTextFromMemory,
    getUrlResponseBodyMap: () => urlResponseBodyMap,
  }
}
