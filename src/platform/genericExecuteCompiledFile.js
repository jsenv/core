import { ressourceToRemoteCompiledFile, ressourceToRemoteInstrumentedFile } from "./locaters.js"

export const genericExecuteCompiledFile = async ({
  loadCompileMeta,
  loadImporter,
  onError,
  transformError,
  readCoverage,
  remoteRoot,
  compileInto,
  file,
  collectNamespace,
  collectCoverage,
  instrument,
}) => {
  const [{ compileId }, { importFile }] = await Promise.all([loadCompileMeta(), loadImporter()])

  const remoteCompiledFile = instrument
    ? ressourceToRemoteInstrumentedFile({ ressource: file, remoteRoot, compileInto, compileId })
    : ressourceToRemoteCompiledFile({ ressource: file, remoteRoot, compileInto, compileId })

  try {
    const namespace = await importFile(remoteCompiledFile)
    return {
      status: "resolved",
      namespace: collectNamespace ? namespace : undefined,
      coverageMap: collectCoverage ? readCoverage() : undefined,
    }
  } catch (error) {
    onError(error)
    return {
      status: "rejected",
      error: transformError(error),
      coverageMap: collectCoverage ? readCoverage() : undefined,
    }
  }
}
