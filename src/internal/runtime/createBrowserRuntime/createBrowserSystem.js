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
