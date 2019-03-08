import "systemjs/dist/system.js"
import { resolveImport, remapResolvedImport } from "@jsenv/module-resolution"
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

  return browserSystem
}
