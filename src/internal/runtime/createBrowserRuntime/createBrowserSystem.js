import { getJavaScriptModuleResponseError } from "../module-registration.js"

import "../s.js"

export const createBrowserSystem = ({
  compileServerOrigin,
  compileDirectoryRelativeUrl,
  importResolver,
  fetchSource,
}) => {
  if (typeof window.System === "undefined") {
    throw new Error(`window.System is undefined`)
  }

  const browserSystem = new window.System.constructor()

  const resolve = (specifier, importer = document.location.href) => {
    return importResolver.resolveImport(specifier, importer)
  }

  browserSystem.resolve = resolve

  const instantiate = browserSystem.instantiate
  browserSystem.instantiate = async function (url, importerUrl) {
    const { importType, urlWithoutImportType } = extractImportTypeFromUrl(url)
    if (importType === "json") {
      const jsonModule = await instantiateAsJsonModule(urlWithoutImportType, {
        loader: this,
        fetchSource,
      })
      return jsonModule
    }

    if (importType === "css") {
      const cssModule = await instantiateAsCssModule(urlWithoutImportType, {
        importerUrl,
        loader: this,
        fetchSource,
      })
      return cssModule
    }

    try {
      const returnValue = await instantiate.call(this, url, importerUrl)
      return returnValue
    } catch (e) {
      const jsenvError = await createDetailedInstantiateError({
        instantiateError: e,
        url,
        importerUrl,
        compileServerOrigin,
        compileDirectoryRelativeUrl,
        fetchSource,
      })
      throw jsenvError
    }
  }

  browserSystem.createContext = (importerUrl) => {
    return {
      url: importerUrl,
      resolve: (specifier) => resolve(specifier, importerUrl),
    }
  }

  return browserSystem
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

const instantiateAsJsonModule = async (url, { loader, fetchSource }) => {
  const response = await fetchSource(url, {
    contentTypeExpected: "application/json",
  })
  const jsonAsText = await response.text()
  const jsonAsJsModule = `System.register([], function (_export) {
  return{
    execute: function () {
     _export("default", '${jsonAsText}')
    }
  }
})`

  // eslint-disable-next-line no-eval
  ;(0, window.eval)(jsonAsJsModule)
  return loader.getRegister(url)
}

const instantiateAsCssModule = async (
  url,
  { importerUrl, loader, fetchSource },
) => {
  const response = await fetchSource(url, {
    contentTypeExpected: "text/css",
  })
  const cssText = await response.text()
  const cssTextWithBaseUrl = cssWithBaseUrl({
    cssText,
    cssUrl: url,
    baseUrl: importerUrl,
  })
  const cssAsJsModule = `System.register([], function (_export) {
  return {
    execute: function () {
      var sheet = new CSSStyleSheet()
      sheet.replaceSync(${JSON.stringify(cssTextWithBaseUrl)})
      _export('default', sheet)
    }
  }
})`

  // eslint-disable-next-line no-eval
  ;(0, window.eval)(cssAsJsModule)
  return loader.getRegister(url)
}

// CSSStyleSheet accepts a "baseUrl" parameter
// as documented in https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/CSSStyleSheet#parameters
// Unfortunately the polyfill do not seems to implement it
// So we reuse "systemjs" strategy from  https://github.com/systemjs/systemjs/blob/98609dbeef01ec62447e4b21449ce47e55f818bd/src/extras/module-types.js#L37
const cssWithBaseUrl = ({ cssUrl, cssText, baseUrl }) => {
  const cssDirectoryUrl = new URL("./", cssUrl).href
  const baseDirectoryUrl = new URL("./", baseUrl).href
  if (cssDirectoryUrl === baseDirectoryUrl) {
    return cssText
  }

  const cssTextRelocated = cssText.replace(
    /url\(\s*(?:(["'])((?:\\.|[^\n\\"'])+)\1|((?:\\.|[^\s,"'()\\])+))\s*\)/g,
    (match, quotes, relUrl1, relUrl2) => {
      const urlRelativeToBase = new URL(relUrl1 || relUrl2, baseUrl).href
      return `url("${quotes}${urlRelativeToBase}${quotes}")`
    },
  )
  return cssTextRelocated
}

const createDetailedInstantiateError = async ({
  instantiateError,
  url,
  importerUrl,
  compileServerOrigin,
  compileDirectoryRelativeUrl,
  fetchSource,
}) => {
  let response
  try {
    response = await fetchSource(url, {
      importerUrl,
      contentTypeExpected: "application/javascript",
    })
  } catch (e) {
    e.code = "NETWORK_FAILURE"
    return e
  }

  const jsModuleResponseError = await getJavaScriptModuleResponseError(
    response,
    {
      url,
      importerUrl,
      compileServerOrigin,
      compileDirectoryRelativeUrl,
    },
  )
  return jsModuleResponseError || instantiateError
}
