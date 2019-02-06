import { fromRemoteFile } from "./registerModuleFrom.js"

export const overrideSystemInstantiate = ({
  localRoot,
  compileInto,
  compileId,
  remoteRoot,
  fetchSource,
  platformSystem,
  moduleSourceToSystemRegisteredModule,
}) => {
  platformSystem.instantiate = (moduleSpecifier, moduleSpecifierFile) => {
    return fromRemoteFile({
      localRoot,
      compileInto,
      compileId,
      remoteRoot,
      fetchSource,
      platformSystem,
      moduleSourceToSystemRegisteredModule,
      remoteFile: moduleSpecifier,
      remoteParent: moduleSpecifierFile,
    })
  }
}
