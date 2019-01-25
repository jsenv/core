import { fromRemoteFile } from "./registerParamFrom.js"

export const overrideSystemInstantiate = ({
  System,
  remoteRoot,
  localRoot,
  compileInto,
  compileId,
  fetchSource,
  evalSource,
}) => {
  System.instantiate = (moduleSpecifier, moduleSpecifierFile) => {
    return fromRemoteFile({
      System,
      remoteRoot,
      localRoot,
      compileInto,
      compileId,
      remoteFile: moduleSpecifier,
      remoteParent: moduleSpecifierFile,
      fetchSource,
      evalSource,
    })
  }
}
