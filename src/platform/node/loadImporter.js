import { memoizeOnce } from "@dmail/helper"
import { createImporter } from "./system/createImporter.js"
import { fetchSource } from "./fetchSource.js"
import { evalSource } from "./evalSource.js"
import { loadCompileMeta } from "./loadCompileMeta.js"

export const loadImporter = memoizeOnce(({ localRoot, compileInto, remoteRoot }) => {
  const { compileId } = loadCompileMeta({ localRoot, compileInto })
  const importer = createImporter({
    remoteRoot,
    localRoot,
    compileInto,
    compileId,
    fetchSource,
    evalSource,
  })
  return importer
})
