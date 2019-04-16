import { fileRead } from "@dmail/helper"
import { wrapImportMap } from "../../import-map/wrapImportMap.js"
import { compileFile } from "../compile-file/index.js"

export const compileImportMap = async ({
  projectFolder,
  compileInto,
  headers,
  compileId,
  filenameRelative,
  filename,
}) => {
  filenameRelative = `${compileInto}/${compileId}/${filenameRelative}`
  filename = `${projectFolder}/${filenameRelative}`

  return compileFile({
    projectFolder,
    headers,
    filenameRelative,
    filename,
    compile: async ({ filename }) => {
      const source = await fileRead(filename)
      return basicCompileImportMap({
        compileInto,
        compileId,
        source,
      })
    },
  })
}

const basicCompileImportMap = async ({ compileInto, compileId, source }) => {
  const importMap = JSON.parse(source)
  const groupImportMap = wrapImportMap(importMap, `${compileInto}/${compileId}`)
  const compiledSource = JSON.stringify(groupImportMap, null, "  ")

  return {
    compiledSource,
    contentType: "application/json",
  }
}
