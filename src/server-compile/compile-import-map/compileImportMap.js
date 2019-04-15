import { wrapImportMap } from "../../import-map/wrapImportMap.js"

export const compileImportMap = async ({ compileInto, compileId, source }) => {
  const importMap = JSON.parse(source)
  const groupImportMap = wrapImportMap(importMap, `${compileInto}/${compileId}`)
  const compiledSource = JSON.stringify(groupImportMap, null, "  ")

  return {
    compiledSource,
    contentType: "application/json",
  }
}
