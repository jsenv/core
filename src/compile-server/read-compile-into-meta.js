import { fileRead } from "@dmail/helper"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"

export const readCompileIntoMeta = async ({ projectPathname, compileIntoRelativePath }) => {
  try {
    const compileIntoMetaFilePath = pathnameToOperatingSystemPath(
      `${projectPathname}${compileIntoRelativePath}/meta.json`,
    )
    const source = await fileRead(compileIntoMetaFilePath)
    return JSON.parse(source)
  } catch (e) {
    if (e && e.code === "ENOENT") {
      return null
    }
    throw e
  }
}
