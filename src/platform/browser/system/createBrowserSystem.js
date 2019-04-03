import "/node_modules/systemjs/dist/system.js"
import { resolveImport, remapResolvedImport } from "/node_modules/@jsenv/module-resolution/index.js"
import { hrefToFilenameRelative } from "../../hrefToFilenameRelative.js"
import { fromHref } from "../../registerModuleFrom.js"
import { moduleSourceToSystemRegisteredModule } from "../moduleSourceToSystemRegisteredModule.js"

export const createBrowserSystem = ({
  compileInto,
  sourceOrigin, // in browser it is undefined because it could be a sensitive information
  compileServerOrigin,
  compileId,
  importMap,
  fetchSource,
}) => {
  const browserSystem = new window.System.constructor()

  browserSystem.resolve = (specifier, importer) => {
    const resolvedImport = resolveImport({
      importer,
      specifier,
    })

    return remapResolvedImport({
      importMap,
      importerHref: importer,
      resolvedImport,
    })
  }

  browserSystem.instantiate = (href, importer) => {
    return fromHref({
      compileInto,
      sourceOrigin,
      compileServerOrigin,
      compileId,
      fetchSource,
      platformSystem: browserSystem,
      moduleSourceToSystemRegisteredModule,
      href,
      importer,
    })
  }

  browserSystem.createContext = (moduleUrl) => {
    const filenameRelative = hrefToFilenameRelative(moduleUrl, { compileInto, compileServerOrigin })
    const fileURL = `${compileServerOrigin}/${filenameRelative}`
    const url = fileURL

    return { url }
  }

  return browserSystem
}
