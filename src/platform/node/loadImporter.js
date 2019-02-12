import { memoizeOnce } from "@dmail/helper"
import { createImporter } from "./system/createImporter.js"
import { loadCompileMeta } from "./loadCompileMeta.js"

export const loadImporter = memoizeOnce(({ compileInto, sourceRootHref, compiledRootHref }) => {
  const { compileId } = loadCompileMeta({ compileInto, sourceRootHref, compiledRootHref })

  const importer = createImporter({
    compileInto,
    sourceRootHref,
    compiledRootHref,
    compileId,
  })

  return importer
})
