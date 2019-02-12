import { genericImportCompiledFile } from "../genericImportCompiledFile.js"
import { loadCompileMeta } from "./loadCompileMeta.js"
import { loadImporter } from "./loadImporter.js"

export const importCompiledFile = ({ compileInto, sourceRootHref, compiledRootHref, pathname }) =>
  genericImportCompiledFile({
    loadCompileMeta: () => loadCompileMeta({ compileInto, sourceRootHref }),
    loadImporter: () => loadImporter({ compileInto, sourceRootHref, compiledRootHref }),
    compileInto,
    compiledRootHref,
    pathname,
  })
