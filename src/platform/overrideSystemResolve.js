import { hrefToCompileId } from "./hrefToCompileId.js"

export const overrideSystemResolve = ({
  compileInto,
  compileServerOrigin,
  compileId,
  platformSystem,
  resolveRootRelativeSpecifier,
}) => {
  const resolve = platformSystem.resolve
  platformSystem.resolve = async (specifier, importer) => {
    if (specifier[0] === "/") {
      const scopedCompileRootHref = importerToScopedCompiledRootHref({
        compileInto,
        compileServerOrigin,
        compileId,
        importer,
      })
      const href = resolveRootRelativeSpecifier({
        root: scopedCompileRootHref,
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
  compileServerOrigin,
  compileId,
  importer,
}) => {
  if (!importer) return `${compileServerOrigin}/${compileInto}/${compileId}`

  const importerCompileId = hrefToCompileId(importer, {
    compileInto,
    compileServerOrigin,
  })
  if (!importerCompileId) return `${compileServerOrigin}/${compileInto}/${compileId}`

  return `${compileServerOrigin}/${compileInto}/${importerCompileId}`
}
