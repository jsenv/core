import { fileWrite } from "@dmail/helper"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"

export const writeCompileIntoMeta = async ({
  projectPathname,
  compileIntoRelativePath,
  compileIntoMeta,
}) => {
  const compileIntoMetaFilePath = pathnameToOperatingSystemPath(
    `${projectPathname}${compileIntoRelativePath}/meta.json`,
  )
  await fileWrite(compileIntoMetaFilePath, JSON.stringify(compileIntoMeta, null, "  "))
}
