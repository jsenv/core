import { fileWrite } from "@dmail/helper"
import { resolveFileUrl, fileUrlToPath } from "../../urlUtils.js"

export const generateCoverageJsonFile = async ({
  projectDirectoryUrl,
  coverageJsonFileRelativePath,
  coverageJsonFileLog,
  coverageMap,
}) => {
  const coverageJsonFileUrl = resolveFileUrl(coverageJsonFileRelativePath, projectDirectoryUrl)
  const coverageJsonFilePath = fileUrlToPath(coverageJsonFileUrl)

  await fileWrite(coverageJsonFilePath, JSON.stringify(coverageMap, null, "  "))
  if (coverageJsonFileLog) {
    console.log(`-> ${coverageJsonFilePath}`)
  }
}
