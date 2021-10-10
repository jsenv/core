import { transformJs } from "@jsenv/core/src/internal/compiling/js-compilation-service/transformJs.js"
import { escapeTemplateStringSpecialCharacters } from "@jsenv/core/src/internal/escapeTemplateStringSpecialCharacters.js"
import { fetchJavaScriptSourcemap } from "./js_sourcemap_fetcher.js"

export const createUrlLoader = ({
  asServerUrl,
  asProjectUrl,
  asOriginalUrl,
  urlFetcher,
  ressourceBuilder,
  projectDirectoryUrl,
  babelPluginMap,
  urlImporterMap,
  inlineModuleScripts,
  allowJson,
}) => {
  const urlResponseBodyMap = {}

  const loadUrl = async (rollupUrl, { cancellationToken, logger }) => {
    // importing CSS from JS with import assertions
    if (rollupUrl.startsWith("import_type_css:")) {
      const url = asServerUrl(rollupUrl.slice("import_type_css:".length))
      const reference = await ressourceBuilder.createReferenceFoundInJsModule({
        jsUrl: url,
        // the location can be found using urlImporterMap
        ressourceSpecifier: url,
        contentTypeExpected: "text/css",
      })
      await reference.ressource.getReadyPromise()

      const cssText = String(reference.ressource.bufferAfterBuild)
      const cssAsJsModule = convertCssTextToJavascriptModule(cssText)
      return {
        url: response.url,
        code: cssAsJsModule,
        map: null, // TODO: parse and fetch sourcemap from cssText
      }
    }

    const url = asServerUrl(rollupUrl)
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
      urlTrace: () => {
        return createImportTrace({
          url,
          urlImporterMap,
          asOriginalUrl,
          asProjectUrl,
        })
      },
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

    // When json is referenced from js without import assertion and minify is enabled
    // you can get non-minified json (json with spaces)
    // We could fix that by removing white spaces here but that means forwarding minify
    // param and this is only possible in Node.js where minification is less (not?) important
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

const createImportTrace = ({
  url,
  urlImporterMap,
  // asServerUrl,
  asOriginalUrl,
  asProjectUrl,
}) => {
  const firstImporter = urlImporterMap[url]

  const trace = [
    {
      type: "entry",
      url:
        asOriginalUrl(firstImporter.url) ||
        asProjectUrl(firstImporter.url) ||
        firstImporter.url,
      line: firstImporter.line,
      column: firstImporter.column,
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
  next(firstImporter.url)

  return trace
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
