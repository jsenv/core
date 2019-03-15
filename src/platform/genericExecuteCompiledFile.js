import { filenameRelativeToCompiledHref } from "./filenameRelativeToCompiledHref.js"

export const genericExecuteCompiledFile = async ({
  loadCompileMeta,
  loadImporter,
  compileInto,
  compileServerOrigin,
  filenameRelative,
  collectNamespace,
  collectCoverage,
  onError,
  transformError,
  readCoverage,
}) => {
  const [{ compileId }, { importFile }] = await Promise.all([loadCompileMeta(), loadImporter()])

  const fileHref = filenameRelativeToCompiledHref({
    compileInto,
    compileServerOrigin,
    compileId,
    filenameRelative,
  })

  try {
    const namespace = await importFile(fileHref)
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
