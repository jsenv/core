import { hrefToMeta } from "./locaters.js"

export const overrideSystemResolve = ({
  compileInto,
  compileId,
  remoteRoot,
  platformSystem,
  resolveAbsoluteModuleSpecifier,
}) => {
  const resolve = platformSystem.resolve
  platformSystem.resolve = async (moduleSpecifier, moduleSpecifierFile) => {
    if (moduleSpecifier[0] === "/") {
      return resolveAbsoluteModuleSpecifier({
        moduleSpecifier,
        file: moduleSpecifierFile,
        root: moduleSpecifierFileToRoot({
          moduleSpecifierFile,
          remoteRoot,
          compileInto,
          compileId,
        }),
      })
    }
    return resolve(moduleSpecifier, moduleSpecifierFile)
  }
}

const moduleSpecifierFileToRoot = ({ moduleSpecifierFile, remoteRoot, compileInto, compileId }) => {
  if (!moduleSpecifierFile) return `${remoteRoot}/${compileInto}/${compileId}`
  const { compileId: moduleSpecifiedFileCompileId } = hrefToMeta(moduleSpecifierFile, {
    remoteRoot,
    compileInto,
  })
  if (!moduleSpecifiedFileCompileId) return `${remoteRoot}/${compileInto}/${compileId}`
  return `${remoteRoot}/${compileInto}/${moduleSpecifiedFileCompileId}`
}
