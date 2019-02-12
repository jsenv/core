import { genericImportCompiledFile } from "../genericImportCompiledFile.js"
import { loadCompileMeta } from "./loadCompileMeta.js"
import { loadImporter } from "./loadImporter.js"

export const importCompiledFile = ({ compileInto, compileServerOrigin, filenameRelative }) =>
  genericImportCompiledFile({
    loadCompileMeta: () => loadCompileMeta({ compileInto, compileServerOrigin }),
    loadImporter: () => loadImporter({ compileInto, compileServerOrigin }),
    compileInto,
    compileServerOrigin,
    filenameRelative,
  })
