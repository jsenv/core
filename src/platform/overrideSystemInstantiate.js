import { fromHref } from "./registerModuleFrom.js"

export const overrideSystemInstantiate = ({
  compileInto,
  sourceOrigin,
  compileServerOrigin,
  compileId,
  fetchSource,
  platformSystem,
  moduleSourceToSystemRegisteredModule,
}) => {
  platformSystem.instantiate = (href, importer) => {
    return fromHref({
      compileInto,
      sourceOrigin,
      compileServerOrigin,
      compileId,
      fetchSource,
      platformSystem,
      moduleSourceToSystemRegisteredModule,
      href,
      importer,
    })
  }
}
