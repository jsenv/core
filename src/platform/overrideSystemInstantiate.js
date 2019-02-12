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
  platformSystem.instantiate = (href, importer) => {
    return fromRemoteFile({
      localRoot,
      compileInto,
      compileId,
      remoteRoot,
      fetchSource,
      platformSystem,
      moduleSourceToSystemRegisteredModule,
      remoteFile: href,
      remoteParent: importer,
    })
  }
}
