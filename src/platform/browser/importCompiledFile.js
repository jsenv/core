import { genericImportCompiledFile } from "../genericImportCompiledFile.js"
import { loadCompileMeta } from "./loadCompileMeta.js"
import { loadImporter } from "./loadImporter.js"

export const importCompiledFile = ({ compileInto, compiledRootHref, pathname }) =>
  genericImportCompiledFile({
    loadCompileMeta: () => loadCompileMeta({ compileInto, compiledRootHref }),
    loadImporter: () => loadImporter({ compileInto, compiledRootHref }),
    compileInto,
    compiledRootHref,
    pathname,
  })
