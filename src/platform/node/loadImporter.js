import { memoizeOnce, fileRead } from "/node_modules/@dmail/helper/index.js"
import { hrefToPathname } from "/node_modules/@jsenv/module-resolution/index.js"
import { createImporter } from "./system/createImporter.js"
import { loadCompileMeta } from "./loadCompileMeta.js"

export const loadImporter = memoizeOnce(
  async ({ compileInto, sourceOrigin, compileServerOrigin }) => {
    const { compileId } = await loadCompileMeta({ compileInto, sourceOrigin, compileServerOrigin })

    const importMapHref = `${sourceOrigin}/${compileInto}/importMap.${compileId}.json`
    const importMapPathname = hrefToPathname(importMapHref)
    const importMapFileContent = await fileRead(importMapPathname)
    const importMap = JSON.parse(importMapFileContent)

    const { importFile } = await createImporter({
      importMap,
      compileInto,
      sourceOrigin,
      compileServerOrigin,
      compileId,
    })

    return { compileId, importFile }
  },
)
