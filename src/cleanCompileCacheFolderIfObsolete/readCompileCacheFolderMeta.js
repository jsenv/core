import { fileRead } from "@dmail/helper"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"

export const readCompileCacheFolderMeta = async ({
  projectPathname,
  compileCacheFolderRelativePath,
}) => {
  try {
    const compileCacheFolderMetaFilePath = pathnameToOperatingSystemPath(
      `${projectPathname}${compileCacheFolderRelativePath}/meta.json`,
    )
    const source = await fileRead(compileCacheFolderMetaFilePath)
    return JSON.parse(source)
  } catch (e) {
    if (e && e.code === "ENOENT") {
      return null
    }
    throw e
  }
}
