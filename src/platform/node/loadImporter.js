import { memoizeOnce } from "@dmail/helper"
import { createImporter } from "./system/createImporter.js"
import { loadCompileMeta } from "./loadCompileMeta.js"

export const loadImporter = memoizeOnce(({ compileInto, sourceRootHref, compileServerOrigin }) => {
  const { compileId } = loadCompileMeta({ compileInto, sourceRootHref, compileServerOrigin })

  const importer = createImporter({
    compileInto,
    sourceRootHref,
    compileServerOrigin,
    compileId,
  })

  return importer
})
