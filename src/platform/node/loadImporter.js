import { memoizeOnce, fileRead } from "@dmail/helper"
import { fileHrefToPathname } from "@jsenv/module-resolution"
import { createImporter } from "./system/createImporter.js"
import { loadCompileMeta } from "./loadCompileMeta.js"

export const loadImporter = memoizeOnce(
  async ({ compileInto, sourceOrigin, compileServerOrigin }) => {
    const { compileId } = await loadCompileMeta({ compileInto, sourceOrigin, compileServerOrigin })

    const importMapHref = `${sourceOrigin}/${compileInto}/groupDescription.json`
    const importMapPathname = fileHrefToPathname(importMapHref)
    const importMapFileContent = await fileRead(importMapPathname)
    const importMap = JSON.parse(importMapFileContent)

    const importer = createImporter({
      importMap,
      compileInto,
      sourceOrigin,
      compileServerOrigin,
      compileId,
    })

    return importer
  },
)
