import { genericImportCompiledFile } from "../platform/genericImportCompiledFile.js"
import { loadCompileMeta } from "./loadCompileMeta.js"
import { loadNodeImporter } from "./loadNodeImporter.js"

export const importCompiledFile = ({
  compileInto,
  sourceOrigin,
  compileServerOrigin,
  filenameRelative,
}) =>
  genericImportCompiledFile({
    loadCompileMeta: () => loadCompileMeta({ compileInto, sourceOrigin, compileServerOrigin }),
    loadImporter: () => loadNodeImporter({ compileInto, sourceOrigin, compileServerOrigin }),
    compileInto,
    compileServerOrigin,
    filenameRelative,
  })
