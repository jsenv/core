import { genericImportCompiledFile } from "../genericImportCompiledFile.js"
import { loadBrowserImporter } from "./loadBrowserImporter.js"

export const importCompiledFile = ({ compileInto, compileServerOrigin, filenameRelative }) =>
  genericImportCompiledFile({
    loadImporter: () => loadBrowserImporter({ compileInto, compileServerOrigin }),
    compileInto,
    compileServerOrigin,
    filenameRelative,
  })
