import "../s.js"
import { valueInstall } from "../valueInstall.js"
import { fromUrl } from "../module-registration.js"
import { evalSource } from "./evalSource.js"

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

  browserSystem.instantiate = (url, importerUrl) => {
    return fromUrl({
      url,
      importerUrl,
      fetchSource,
      instantiateJavaScript: (source, responseUrl) => {
        const uninstallSystemGlobal = valueInstall(
          window,
          "System",
          browserSystem,
        )
        try {
          evalSource(source, responseUrl)
        } finally {
          uninstallSystemGlobal()
        }

        return browserSystem.getRegister()
      },
      compileServerOrigin,
      compileDirectoryRelativeUrl,
    })
  }

  browserSystem.createContext = (importerUrl) => {
    return {
      url: importerUrl,
      resolve: (specifier) => resolve(specifier, importerUrl),
    }
  }

  return browserSystem
}
