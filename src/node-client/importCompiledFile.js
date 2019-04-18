import { genericImportCompiledFile } from "../platform/genericImportCompiledFile.js"
import { loadNodeImporter } from "./loadNodeImporter.js"

export const importCompiledFile = ({
  compileInto,
  sourceOrigin,
  compileServerOrigin,
  filenameRelative,
}) =>
  genericImportCompiledFile({
    loadImporter: () => loadNodeImporter({ compileInto, sourceOrigin, compileServerOrigin }),
    compileInto,
    compileServerOrigin,
    filenameRelative,
  })
