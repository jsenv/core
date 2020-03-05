import { resolveUrl, urlToFileSystemPath, writeFile } from "@jsenv/util"

export const generateCoverageJsonFile = async ({
  logger,
  projectDirectoryUrl,
  coverageJsonFileRelativeUrl,
  coverageJsonFileLog,
  coverageMap,
}) => {
  const coverageJsonFileUrl = resolveUrl(coverageJsonFileRelativeUrl, projectDirectoryUrl)

  await writeFile(coverageJsonFileUrl, JSON.stringify(coverageMap, null, "  "))
  if (coverageJsonFileLog) {
    logger.info(`-> ${urlToFileSystemPath(coverageJsonFileUrl)}`)
  }
}
