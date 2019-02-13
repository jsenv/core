import { genericImportCompiledFile } from "../genericImportCompiledFile.js"
import { loadCompileMeta } from "./loadCompileMeta.js"
import { loadImporter } from "./loadImporter.js"

export const importCompiledFile = ({
  compileInto,
  sourceOrigin,
  compileServerOrigin,
  filenameRelative,
}) =>
  genericImportCompiledFile({
    loadCompileMeta: () => loadCompileMeta({ compileInto, sourceOrigin }),
    loadImporter: () => loadImporter({ compileInto, sourceOrigin, compileServerOrigin }),
    compileInto,
    compileServerOrigin,
    filenameRelative,
  })
