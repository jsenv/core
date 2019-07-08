import { fileRead } from "@dmail/helper"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"

export const readProjectImportMap = async ({ projectPathname, importMapRelativePath }) => {
  if (!importMapRelativePath) return {}

  try {
    const importMapString = await fileRead(
      pathnameToOperatingSystemPath(`${projectPathname}/${importMapRelativePath}`),
    )
    return JSON.parse(importMapString)
  } catch (e) {
    if (e && e.code === "ENOENT") {
      return {}
    }
    throw e
  }
}
