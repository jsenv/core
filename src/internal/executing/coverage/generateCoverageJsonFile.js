import { writeFile, urlToFileSystemPath } from "@jsenv/filesystem"

import { byteAsFileSize } from "@jsenv/core/src/internal/logs/byteAsFileSize.js"

export const generateCoverageJsonFile = async ({
  coverage,
  coverageJsonFileUrl,
  coverageJsonFileLog,
  logger,
}) => {
  const coverageAsText = JSON.stringify(coverage, null, "  ")

  if (coverageJsonFileLog) {
    logger.info(
      `-> ${urlToFileSystemPath(coverageJsonFileUrl)} (${byteAsFileSize(
        Buffer.byteLength(coverageAsText),
      )})`,
    )
  }

  await writeFile(coverageJsonFileUrl, coverageAsText)
}
