import { resolveUrl, urlToFileSystemPath, writeFileContent } from "@jsenv/util"

export const generateCoverageJsonFile = async ({
  projectDirectoryUrl,
  coverageJsonFileRelativeUrl,
  coverageJsonFileLog,
  coverageMap,
}) => {
  const coverageJsonFileUrl = resolveUrl(coverageJsonFileRelativeUrl, projectDirectoryUrl)
  const coverageJsonFilePath = urlToFileSystemPath(coverageJsonFileUrl)

  await writeFileContent(coverageJsonFilePath, JSON.stringify(coverageMap, null, "  "))
  if (coverageJsonFileLog) {
    console.log(`-> ${coverageJsonFilePath}`)
  }
}
