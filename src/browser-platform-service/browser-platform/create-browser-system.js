/* eslint-disable import/max-dependencies */
import { resolvePath } from "@jsenv/module-resolution"
import "../../system/s.js"
import { createImportTracker } from "../../platform/createImportTracker.js"
import { hrefToFileRelativePath } from "../../platform/hrefToFileRelativePath.js"
import { valueInstall } from "../../platform/valueInstall.js"
import {
  fromFunctionReturningNamespace,
  fromHref,
  createModuleExecutionError,
} from "../../platform/registerModuleFrom/index.js"
import { fetchSource } from "./fetchSource.js"
import { evalSource } from "./evalSource.js"

const GLOBAL_SPECIFIER = "global"

export const createBrowserSystem = async ({
  compileServerOrigin,
  compileIntoRelativePath,
  importMap,
  importDefaultExtension,
}) => {
  if (typeof window.System === "undefined") throw new Error(`window.System is undefined`)

  const browserSystem = new window.System.constructor()

  browserSystem.resolve = (specifier, importer) => {
    if (specifier === GLOBAL_SPECIFIER) return specifier

    return resolvePath({
      specifier,
      importer,
      importMap,
      defaultExtension: importDefaultExtension,
    })
  }

  const importTracker = createImportTracker()
  browserSystem.instantiate = (href, importerHref) => {
    if (href === GLOBAL_SPECIFIER)
      return fromFunctionReturningNamespace(() => window, { href, importerHref })

    importTracker.markHrefAsImported(href)

    return fromHref({
      href,
      importerHref,
      fetchSource,
      instantiateJavaScript: (source, realHref) => {
        const uninstallSystemGlobal = valueInstall(window, "System", browserSystem)
        try {
          evalSource(source, realHref)
        } finally {
          uninstallSystemGlobal()
        }

        return browserSystem.getRegister()
      },
    })
  }

  browserSystem.createContext = (moduleUrl) => {
    const fileRelativePath = hrefToFileRelativePath(moduleUrl, {
      compileServerOrigin,
      compileIntoRelativePath,
    })
    const fileURL = `${compileServerOrigin}${fileRelativePath}`
    const url = fileURL

    return { url }
  }

  const importMethod = browserSystem.import
  browserSystem.import = function(specifier) {
    return importMethod.call(this, specifier).catch((error) => {
      if (!error) return Promise.reject(error)
      if (error.code) return Promise.reject(error)

      // give some context to the error
      return Promise.reject(
        createModuleExecutionError({
          href: error.id,
          executionError: error,
          importerHref: error.pid,
        }),
      )
    })
  }

  return browserSystem
}
