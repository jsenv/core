import { pathnameToInstrumentedHref, pathnameToCompiledHref } from "./locaters.js"

export const genericExecuteCompiledFile = async ({
  loadCompileMeta,
  loadImporter,
  onError,
  transformError,
  readCoverage,
  compileInto,
  compiledRootHref,
  pathname,
  collectNamespace,
  collectCoverage,
  instrument,
}) => {
  const [{ compileId }, { importFile }] = await Promise.all([loadCompileMeta(), loadImporter()])

  const fileHref = instrument
    ? pathnameToInstrumentedHref({
        pathname,
        compileInto,
        compiledRootHref,
        compileId,
      })
    : pathnameToCompiledHref({ pathname, compileInto, compiledRootHref, compileId })

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
