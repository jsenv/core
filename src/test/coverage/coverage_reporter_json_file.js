import { writeFile } from "@jsenv/filesystem"
import { urlToFileSystemPath } from "@jsenv/urls"
import { byteAsFileSize } from "@jsenv/log"

export const generateCoverageJsonFile = async ({
  coverage,
  coverageJsonFileUrl,
  logger,
}) => {
  const coverageAsText = JSON.stringify(coverage, null, "  ")
  logger.info(
    `-> ${urlToFileSystemPath(coverageJsonFileUrl)} (${byteAsFileSize(
      Buffer.byteLength(coverageAsText),
    )})`,
  )
  await writeFile(coverageJsonFileUrl, coverageAsText)
}
