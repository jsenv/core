import { ressourceToRemoteCompiledFile } from "./locaters.js"

export const genericImportCompiledFile = async ({
  loadCompileMeta,
  loadImporter,
  remoteRoot,
  compileInto,
  file,
}) => {
  const [{ compileId }, { importFile }] = await Promise.all([loadCompileMeta(), loadImporter()])

  const remoteCompiledFile = ressourceToRemoteCompiledFile({
    ressource: file,
    remoteRoot,
    compileInto,
    compileId,
  })

  return importFile(remoteCompiledFile)
}
