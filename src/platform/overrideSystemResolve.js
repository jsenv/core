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
      // todo: test what is importer here because it should
      // start with http:// otherwise resolution will kinda fail
      // no?
      return resolveRootRelativeSpecifier({
        root: importerToRoot({
          compileInto,
          compileId,
          remoteRoot,
          importer,
        }),
        importer,
        specifier,
      })
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
