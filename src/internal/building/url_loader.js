import { resolveUrl, urlToFilename } from "@jsenv/filesystem"

import { transformJs } from "@jsenv/core/src/internal/compiling/js-compilation-service/transformJs.js"
import { getUrlSearchParamsDescriptor } from "@jsenv/core/src/internal/url_utils.js"
import { convertCssTextToJavascriptModule } from "@jsenv/core/src/internal/building/css_module.js"
import {
  getJavaScriptSourceMappingUrl,
  getCssSourceMappingUrl,
} from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { loadSourcemap } from "./sourcemap_loader.js"

export const createUrlLoader = ({
  projectDirectoryUrl,
  buildDirectoryUrl,
  babelPluginMap,
  allowJson,
  urlImporterMap,
  inlineModuleScripts,

  asServerUrl,
  asProjectUrl,
  asOriginalUrl,

  urlFetcher,
  getRessourceBuilder,
}) => {
  const urlResponseBodyMap = {}

  const loadUrl = async (rollupUrl, { cancellationToken, logger }) => {
    const { import_type } = getUrlSearchParamsDescriptor(rollupUrl)
    let url = asServerUrl(rollupUrl)

    // importing CSS from JS with import assertions
    if (import_type === "css") {
      // si le format est esmodule et qu'on génere un chunk pour ce fichier
      const ressourceAsImportAssertion = await loadRessourceAsImportAssertion({
        buildDirectoryUrl,
        url,
        urlImporterMap,
        ressourceBuilder: getRessourceBuilder(),
        contentTypeExpected: "text/css",
      })
      let code = ressourceAsImportAssertion.code
      let map = await loadSourcemap({
        cancellationToken,
        logger,

        url: ressourceAsImportAssertion.ressourceBuildUrl,
        code,
        getSourceMappingUrl: getCssSourceMappingUrl,
      })
      const jsModuleConversionResult = await convertCssTextToJavascriptModule({
        cssUrl: ressourceAsImportAssertion.ressourceBuildUrl,
        jsUrl: ressourceAsImportAssertion.jsBuildUrl,
        code,
        map,
      })

      code = jsModuleConversionResult.code
      map = jsModuleConversionResult.map

      return {
        url,
        code,
        map,
      }
    }

    if (url in inlineModuleScripts) {
      const transformResult = await transformJs({
        code: inlineModuleScripts[url],
        url: asProjectUrl(url), // transformJs expect a file:// url
        projectDirectoryUrl,
        babelPluginMap,
        // moduleOutFormat: format // we are compiling for rollup output must be "esmodule"
      })
      let code = transformResult.code
      let map = transformResult.map
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
        ...(allowJson ? ["application/json"] : []),
      ],
      urlTrace: () => createUrlTrace(url),
    })

    const contentType = response.headers["content-type"]
    if (contentType === "application/javascript") {
      const jsText = await response.text()
      saveUrlResponseBody(response.url, jsText)
      const map = await loadSourcemap({
        cancellationToken,
        logger,

        url,
        code: jsText,
        getSourceMappingUrl: getJavaScriptSourceMappingUrl,
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

  const createUrlTrace = (url) => {
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

  return {
    loadUrl,
    createUrlTrace,
    getUrlResponseTextFromMemory,
    getUrlResponseBodyMap: () => urlResponseBodyMap,
  }
}

const loadRessourceAsImportAssertion = async ({
  buildDirectoryUrl,
  url,
  urlImporterMap,
  ressourceBuilder,
  contentTypeExpected,
}) => {
  const importer = urlImporterMap[url]
  const reference = await ressourceBuilder.createReferenceFoundInJsModule({
    jsUrl: importer.url,
    jsLine: importer.line,
    jsColumn: importer.column,
    ressourceSpecifier: url,
    contentTypeExpected,
  })
  await reference.ressource.getReadyPromise()
  // this reference is "inlined" because it becomes something else
  // (css string becomes a js module for example)
  reference.inlinedCallback()

  // const moduleInfo = rollupGetModuleInfo(asRollupUrl(importer.url))
  const ressourceBuildUrl = resolveUrl(
    reference.ressource.buildRelativeUrl,
    buildDirectoryUrl,
  )
  const jsBuildUrl = resolveUrl(urlToFilename(importer.url), buildDirectoryUrl)
  const code = String(reference.ressource.bufferAfterBuild)

  return {
    ressourceBuildUrl,
    jsBuildUrl,
    code,
  }
}

const convertJsonTextToJavascriptModule = (jsonText) => {
  // here we could do the following
  // return export default jsonText
  // This would return valid js, that would be minified later
  // however we will prefer using JSON.parse because it's faster
  // for js engine to parse JSON than JS

  return `export default JSON.parse(${jsonText})`
}
