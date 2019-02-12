import { fromHref } from "./registerModuleFrom.js"

export const overrideSystemInstantiate = ({
  compileInto,
  sourceRootHref,
  compiledRootHref,
  compileId,
  fetchSource,
  platformSystem,
  moduleSourceToSystemRegisteredModule,
}) => {
  platformSystem.instantiate = (href, importer) => {
    return fromHref({
      compileInto,
      sourceRootHref,
      compiledRootHref,
      compileId,
      fetchSource,
      platformSystem,
      moduleSourceToSystemRegisteredModule,
      href,
      importer,
    })
  }
}
