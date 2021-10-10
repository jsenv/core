import { transformJs } from "@jsenv/core/src/internal/compiling/js-compilation-service/transformJs.js"
import { escapeTemplateStringSpecialCharacters } from "@jsenv/core/src/internal/escapeTemplateStringSpecialCharacters.js"
import { fetchJavaScriptSourcemap } from "./js_sourcemap_fetcher.js"

export const createUrlLoader = ({ urlFetcher, asProjectUrl }) => {
  const urlResponseBodyMap = {}

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
      const response = await urlFetcher.fetchUrl(url, {
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

    const response = await urlFetcher.fetchUrl(url, {
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

  return {
    loadUrl,
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
