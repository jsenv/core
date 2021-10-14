import { resolveUrl, urlToFilename } from "@jsenv/filesystem"

import { transformJs } from "@jsenv/core/src/internal/compiling/js-compilation-service/transformJs.js"
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
}) => {
  const urlResponseBodyMap = {}

  const loadUrl = async (
    rollupUrl,
    { cancellationToken, logger, ressourceBuilder },
  ) => {
    let url = asServerUrl(rollupUrl)
    const { importType, urlWithoutImportType } = extractImportTypeFromUrl(url)

    // importing CSS from JS with import assertions
    if (importType === "css") {
      const importer = urlImporterMap[url]
      const cssReference =
        await ressourceBuilder.createReferenceFoundInJsModule({
          // If all references to a ressource are only import assertions
          // the file referenced do not need to be written on filesystem
          // as it was converted to a js file
          // We pass "isImportAssertion: true" for this purpose
          isImportAssertion: true,
          jsUrl: importer.url,
          jsLine: importer.line,
          jsColumn: importer.column,
          ressourceSpecifier: urlWithoutImportType,
          contentTypeExpected: "text/css",
        })
      await cssReference.ressource.getReadyPromise()
      const cssBuildUrl = resolveUrl(
        cssReference.ressource.buildRelativeUrl,
        buildDirectoryUrl,
      )
      const jsBuildUrl = resolveUrl(
        urlToFilename(importer.url),
        buildDirectoryUrl,
      )
      let code = String(cssReference.ressource.bufferAfterBuild)
      let map = await loadSourcemap({
        cancellationToken,
        logger,

        url: cssBuildUrl,
        code,
        getSourceMappingUrl: getCssSourceMappingUrl,
      })

      const jsModuleConversionResult = await convertCssTextToJavascriptModule({
        cssUrl: cssBuildUrl,
        jsUrl: jsBuildUrl,
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

    // importing json from JS with import assertion
    if (importType === "json") {
      const importer = urlImporterMap[url]
      const jsonReference =
        await ressourceBuilder.createReferenceFoundInJsModule({
          // If all references to a ressource are only import assertions
          // the file referenced do not need to be written on filesystem
          // as it was converted to a js file
          // We pass "isImportAssertion: true" for this purpose
          isImportAssertion: true,
          jsUrl: importer.url,
          jsLine: importer.line,
          jsColumn: importer.column,
          ressourceSpecifier: asServerUrl(urlWithoutImportType),
          contentTypeExpected: "application/json",
        })
      await jsonReference.ressource.getReadyPromise()
      let code = String(jsonReference.ressource.bufferAfterBuild)
      let map

      const jsModuleConversionResult = await convertJsonTextToJavascriptModule({
        code,
        map,
      })
      code = jsModuleConversionResult.code
      map = jsModuleConversionResult.map

      return {
        url,
        code,
      }
    }

    if (url in inlineModuleScripts) {
      const transformResult = await transformJs({
        code: inlineModuleScripts[url],
        url: asOriginalUrl(url), // transformJs expect a file:// url
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
      urlTrace: () => {
        url = asOriginalUrl(url) || asProjectUrl(url) || url
        const firstImporter = urlImporterMap[url]
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
    const { code } = convertJsonTextToJavascriptModule({ code: jsonText })
    return {
      url: response.url,
      code,
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

  const createUrlTrace = ({ url, line, column }) => {
    url = asOriginalUrl(url) || asProjectUrl(url) || url
    const trace = [
      {
        type: "entry",
        url,
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

const extractImportTypeFromUrl = (url) => {
  const urlObject = new URL(url)
  const { search } = urlObject
  const searchParams = new URLSearchParams(search)

  const importType = searchParams.get("import_type")
  if (!importType) {
    return {}
  }

  searchParams.delete("import_type")
  urlObject.search = String(searchParams)
  return {
    importType,
    urlWithoutImportType: urlObject.href,
  }
}

const convertJsonTextToJavascriptModule = ({ code }) => {
  // here we could do the following
  // return export default jsonText
  // This would return valid js, that would be minified later
  // however we will prefer using JSON.parse because it's faster
  // for js engine to parse JSON than JS

  return {
    code: `export default JSON.parse(${JSON.stringify(code.trim())})`,
  }
}
