import "../../../systemjs/system.js" // awaiting https://github.com/systemjs/systemjs/issues/1898
import { remapResolvedImport } from "@jsenv/module-resolution"
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

  const resolve = browserSystem.resolve
  browserSystem.resolve = (specifier, importer) => {
    const href = resolve(specifier, importer)
    return remapResolvedImport({
      importMap,
      importerHref: importer,
      resolvedImport: href,
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
