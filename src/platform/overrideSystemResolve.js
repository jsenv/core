import { hrefToMeta } from "./locaters.js"

export const overrideSystemResolve = ({
  compileInto,
  compiledRootHref,
  compileId,
  platformSystem,
  resolveRootRelativeSpecifier,
}) => {
  const resolve = platformSystem.resolve
  platformSystem.resolve = async (specifier, importer) => {
    if (specifier[0] === "/") {
      const scopedCompiledRootHref = importerToScopedCompiledRootHref({
        compileInto,
        compiledRootHref,
        compileId,
        importer,
      })
      const href = resolveRootRelativeSpecifier({
        root: scopedCompiledRootHref,
        importer,
        specifier,
      })
      return href
    }
    return resolve(specifier, importer)
  }
}

const importerToScopedCompiledRootHref = ({
  compileInto,
  compiledRootHref,
  compileId,
  importer,
}) => {
  if (!importer) return `${compiledRootHref}/${compileInto}/${compileId}`
  const { compileId: moduleSpecifiedFileCompileId } = hrefToMeta(importer, {
    compileInto,
    compiledRootHref,
  })
  if (!moduleSpecifiedFileCompileId) return `${compiledRootHref}/${compileInto}/${compileId}`
  return `${compiledRootHref}/${compileInto}/${moduleSpecifiedFileCompileId}`
}
