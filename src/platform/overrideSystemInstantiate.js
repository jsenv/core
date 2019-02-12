import { fromHref } from "./registerModuleFrom.js"

export const overrideSystemInstantiate = ({
  compileInto,
  sourceRootHref,
  compileServerOrigin,
  compileId,
  fetchSource,
  platformSystem,
  moduleSourceToSystemRegisteredModule,
}) => {
  platformSystem.instantiate = (href, importer) => {
    return fromHref({
      compileInto,
      sourceRootHref,
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
