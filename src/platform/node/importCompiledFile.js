import { genericImportCompiledFile } from "../genericImportCompiledFile.js"
import { loadCompileMeta } from "./loadCompileMeta.js"
import { loadImporter } from "./loadImporter.js"

export const importCompiledFile = ({
  compileInto,
  sourceRootHref,
  compileServerOrigin,
  filenameRelative,
}) =>
  genericImportCompiledFile({
    loadCompileMeta: () => loadCompileMeta({ compileInto, sourceRootHref }),
    loadImporter: () => loadImporter({ compileInto, sourceRootHref, compileServerOrigin }),
    compileInto,
    compileServerOrigin,
    filenameRelative,
  })
