import { filenameRelativeToCompiledHref } from "./filenameRelativeToCompiledHref.js"

export const genericImportCompiledFile = async ({
  loadCompileMeta,
  loadImporter,
  compileInto,
  compileServerOrigin,
  filenameRelative,
}) => {
  const [{ compileId }, { importFile }] = await Promise.all([loadCompileMeta(), loadImporter()])

  const compiledHref = filenameRelativeToCompiledHref({
    compileInto,
    compileServerOrigin,
    compileId,
    filenameRelative,
  })

  return importFile(compiledHref)
}
