import { filenameRelativeToCompiledHref } from "./filenameRelativeToCompiledHref.js"

export const genericImportCompiledFile = async ({
  loadImporter,
  compileInto,
  compileServerOrigin,
  filenameRelative,
}) => {
  const { importFile, compileId } = await loadImporter()

  const compiledHref = filenameRelativeToCompiledHref({
    compileInto,
    compileServerOrigin,
    compileId,
    filenameRelative,
  })

  return importFile(compiledHref)
}
