import { fileWrite } from "@dmail/helper"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"

export const generateCoverageJsonReport = async ({
  projectPathname,
  coverageJsonReportRelativePath,
  coverageJsonReportLog,
  coverageMap,
}) => {
  const jsonCoverageFilename = pathnameToOperatingSystemPath(
    `${projectPathname}${coverageJsonReportRelativePath}`,
  )

  await fileWrite(jsonCoverageFilename, JSON.stringify(coverageMap, null, "  "))
  if (coverageJsonReportLog) {
    console.log(`-> ${jsonCoverageFilename}`)
  }
}
