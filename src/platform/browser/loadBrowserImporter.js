import { memoizeOnce } from "@dmail/helper/src/memoizeOnce.js"
import { fetchUsingXHR } from "./fetchUsingXHR.js"
import { loadCompileMeta } from "./loadCompileMeta.js"
import { createSystemImporter } from "./system/createSystemImporter.js"

export const loadBrowserImporter = memoizeOnce(
  async ({ compileInto, compileIdOption, compileServerOrigin }) => {
    const { compileId } = await loadCompileMeta({
      compileInto,
      compileIdOption,
      compileServerOrigin,
    })

    // this importMap is just wrapped into /${compileInto}/${compileId}/ from an other importMap
    // we could wrap the globalImportMap here instead of fetching it
    const importMapHref = `${compileServerOrigin}/${compileInto}/${compileId}/importMap.json`
    const importMapResponse = await fetchUsingXHR(importMapHref)
    const { status } = importMapResponse

    let importMap
    if (status === 404) {
      importMap = {}
    } else if (status < 200 || status >= 400) {
      throw new Error(`unexpected response status for importMap.json, ${status}`)
    } else {
      importMap = JSON.parse(importMapResponse.body)
    }

    const { importFile } = createSystemImporter({
      importMap,
      compileInto,
      compileServerOrigin,
      compileId,
    })

    return { compileId, importFile }
  },
)
