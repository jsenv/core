import { memoizeOnce } from "@dmail/helper"
import { createImporter } from "./system/createImporter.js"
import { loadCompileMeta } from "./loadCompileMeta.js"

export const loadImporter = memoizeOnce(({ localRoot, compileInto, remoteRoot }) => {
  const { compileId } = loadCompileMeta({ localRoot, compileInto })

  const importer = createImporter({
    localRoot,
    compileInto,
    compileId,
    remoteRoot,
  })

  return importer
})
