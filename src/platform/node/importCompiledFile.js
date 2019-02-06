import { genericImportCompiledFile } from "../genericImportCompiledFile.js"
import { loadCompileMeta } from "./loadCompileMeta.js"
import { loadImporter } from "./loadImporter.js"

export const importCompiledFile = ({ localRoot, compileInto, remoteRoot, file }) =>
  genericImportCompiledFile({
    loadCompileMeta: () => loadCompileMeta({ localRoot, compileInto }),
    loadImporter: () => loadImporter({ localRoot, compileInto, remoteRoot }),
    remoteRoot,
    compileInto,
    file,
  })
