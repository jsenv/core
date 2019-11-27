import { writeFileContent } from "internal/filesystemUtils.js"
import { resolveUrl, fileUrlToPath } from "internal/urlUtils.js"

export const generateCoverageJsonFile = async ({
  projectDirectoryUrl,
  coverageJsonFileRelativeUrl,
  coverageJsonFileLog,
  coverageMap,
}) => {
  const coverageJsonFileUrl = resolveUrl(coverageJsonFileRelativeUrl, projectDirectoryUrl)
  const coverageJsonFilePath = fileUrlToPath(coverageJsonFileUrl)

  await writeFileContent(coverageJsonFilePath, JSON.stringify(coverageMap, null, "  "))
  if (coverageJsonFileLog) {
    console.log(`-> ${coverageJsonFilePath}`)
  }
}
