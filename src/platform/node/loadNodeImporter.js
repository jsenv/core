import { memoizeOnce } from "@dmail/helper"
import { fetchUsingHttp } from "./fetchUsingHttp.js"
import { createImporter } from "./system/createImporter.js"
import { loadCompileMeta } from "./loadCompileMeta.js"

export const loadNodeImporter = memoizeOnce(
  async ({ compileInto, compileIdOption, sourceOrigin, compileServerOrigin }) => {
    const { compileId } = await loadCompileMeta({
      compileInto,
      compileIdOption,
      sourceOrigin,
      compileServerOrigin,
    })

    const importMapHref = `${compileServerOrigin}/${compileInto}/${compileId}/importMap.json`
    const importMapResponse = await fetchUsingHttp(importMapHref)
    const { status } = importMapResponse

    let importMap
    if (status === 404) {
      importMap = {}
    } else if (status < 200 || status >= 400) {
      throw new Error(`unexpected response status for importMap.json, ${status}`)
    } else {
      importMap = JSON.parse(importMapResponse.body)
    }

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
