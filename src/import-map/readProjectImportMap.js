import { readFileSync } from "fs"
import { pathnameToOperatingSystemFilename } from "../operating-system-filename.js"

// TODO: make this async
export const readProjectImportMap = ({ projectPathname, importMapRelativePath }) => {
  if (!importMapRelativePath) return {}
  try {
    const buffer = readFileSync(
      pathnameToOperatingSystemFilename(`${projectPathname}/${importMapRelativePath}`),
    )
    const source = String(buffer)
    return JSON.parse(source)
  } catch (e) {
    if (e && e.code === "ENOENT") {
      return {}
    }
    throw e
  }
}
