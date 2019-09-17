import { fileWrite } from "@dmail/helper"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"

export const writeCompileCacheFolderMeta = async ({
  projectPathname,
  compileCacheFolderRelativePath,
  compileCacheFolderMeta,
}) => {
  const cacheMetaMetaFilePath = pathnameToOperatingSystemPath(
    `${projectPathname}${compileCacheFolderRelativePath}/meta.json`,
  )
  await fileWrite(cacheMetaMetaFilePath, JSON.stringify(compileCacheFolderMeta, null, "  "))
}
