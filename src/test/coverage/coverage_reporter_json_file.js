import { writeFile } from "@jsenv/filesystem"
import { urlToFileSystemPath } from "@jsenv/urls"
import { byteAsFileSize } from "@jsenv/log"

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
