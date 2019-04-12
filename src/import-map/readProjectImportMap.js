import { readFileSync } from "fs"

// TODO: make this async
export const readProjectImportMap = ({ projectFolder, importMapFilenameRelative }) => {
  if (!importMapFilenameRelative) return {}
  try {
    const buffer = readFileSync(`${projectFolder}/${importMapFilenameRelative}`)
    const source = String(buffer)
    return JSON.parse(source)
  } catch (e) {
    if (e && e.code === "ENOENT") {
      return {}
    }
    throw e
  }
}
