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
    try {
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
          loader: this,
          fetchSource,
        })
        return cssModule
      }

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
  const response = await fetchSource(url)
  const jsonAsText = await response.text()
  const jsonAsJsModule = `System.register([], function (export) {
  return{
    execute: function () {
     export("default", '${jsonAsText}')
    }
  }
})`

  // eslint-disable-next-line no-eval
  ;(0, window.eval)(jsonAsJsModule)
  return loader.getRegister(url)
}

const instantiateAsCssModule = async (url, { loader, fetchSource }) => {
  const response = await fetchSource(url)
  const cssTextOriginal = await response.text()
  // https://github.com/systemjs/systemjs/blob/98609dbeef01ec62447e4b21449ce47e55f818bd/src/extras/module-types.js#L37
  const cssTextRelocated = cssTextOriginal.replace(
    /url\(\s*(?:(["'])((?:\\.|[^\n\\"'])+)\1|((?:\\.|[^\s,"'()\\])+))\s*\)/g,
    (match, quotes, relUrl1, relUrl2) => {
      return `url(" ${quotes}${resolveUrl(relUrl1 || relUrl2, url)}${quotes}")`
    },
  )
  const cssAsJsModule = `System.register([], function (export) {
  return {
    execute: function () {
      var sheet = new CSSStyleSheet()
      sheet.replaceSync(${JSON.stringify(cssTextRelocated)})
      export('default', sheet)
    }
  }
})`

  // eslint-disable-next-line no-eval
  ;(0, window.eval)(cssAsJsModule)
  return loader.getRegister(url)
}

const resolveUrl = (specifier) => new URL(specifier).href

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
