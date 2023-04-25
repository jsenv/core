import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { normalizeImportMap, resolveImport } from "@jsenv/importmap"

let importMap

const cwdUrl = `${String(pathToFileURL(process.cwd()))}/`

if (process.env.IMPORT_MAP) {
  importMap = JSON.parse(process.env.IMPORT_MAP)
} else if (process.env.IMPORT_MAP_PATH) {
  const importmapFileUrl = pathToFileURL(process.env.IMPORT_MAP_PATH)
  const importmapFileContentAsString = readFileSync(importmapFileUrl, "utf8")
  importMap = JSON.parse(importmapFileContentAsString)
} else {
  const importmapFileUrl = new URL("./import_map.json", cwdUrl)
  const importmapFileContentAsString = readFileSync(importmapFileUrl, "utf8")
  importMap = JSON.parse(importmapFileContentAsString)
}

const importMapBaseUrl = process.env.IMPORT_MAP_BASE_URL || cwdUrl
importMap = normalizeImportMap(importMap, importMapBaseUrl)

export const resolve = (specifier, context, nextResolve) => {
  try {
    let mapped
    const importer = context.parentURL ? String(context.parentURL) : undefined
    const resolved = resolveImport({
      specifier,
      importer,
      importMap,
      defaultExtension: ".js",
      onImportMapping: () => {
        mapped = true
      },
    })
    if (mapped) {
      return {
        shortCircuit: true,
        url: resolved,
      }
    }
  } catch (e) {
    if (e.message.includes("bare specifier")) {
      return nextResolve(specifier)
    }
    console.error(e)
    return nextResolve(specifier)
  }
  return nextResolve(specifier, context)
}
