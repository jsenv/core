import { pathnameToCompiledHref } from "./locaters.js"

export const genericImportCompiledFile = async ({
  loadCompileMeta,
  loadImporter,
  compileInto,
  compiledRootHref,
  pathname,
}) => {
  const [{ compileId }, { importFile }] = await Promise.all([loadCompileMeta(), loadImporter()])

  const compiledHref = pathnameToCompiledHref({
    compileInto,
    compiledRootHref,
    compileId,
    pathname,
  })

  return importFile(compiledHref)
}
