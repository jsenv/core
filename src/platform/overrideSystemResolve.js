import { hrefToMeta } from "./locaters.js"

export const overrideSystemResolve = ({
  compileInto,
  compileId,
  remoteRoot,
  platformSystem,
  resolveRootRelativeSpecifier,
}) => {
  const resolve = platformSystem.resolve
  platformSystem.resolve = async (specifier, importer) => {
    if (specifier[0] === "/") {
      const root = importerToRoot({
        compileInto,
        compileId,
        remoteRoot,
        importer,
      })
      const href = resolveRootRelativeSpecifier({
        root,
        importer,
        specifier,
      })
      return href
    }
    return resolve(specifier, importer)
  }
}

const importerToRoot = ({ compileInto, compileId, remoteRoot, importer }) => {
  if (!importer) return `${remoteRoot}/${compileInto}/${compileId}`
  const { compileId: moduleSpecifiedFileCompileId } = hrefToMeta(importer, {
    compileInto,
    remoteRoot,
  })
  if (!moduleSpecifiedFileCompileId) return `${remoteRoot}/${compileInto}/${compileId}`
  return `${remoteRoot}/${compileInto}/${moduleSpecifiedFileCompileId}`
}
