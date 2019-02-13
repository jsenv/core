import { memoizeOnce } from "@dmail/helper"
import { createImporter } from "./system/createImporter.js"
import { loadCompileMeta } from "./loadCompileMeta.js"

export const loadImporter = memoizeOnce(({ compileInto, sourceOrigin, compileServerOrigin }) => {
  const { compileId } = loadCompileMeta({ compileInto, sourceOrigin, compileServerOrigin })

  const importer = createImporter({
    compileInto,
    sourceOrigin,
    compileServerOrigin,
    compileId,
  })

  return importer
})
