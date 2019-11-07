import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"

const libReport = import.meta.require("istanbul-lib-report")
const reports = import.meta.require("istanbul-reports")
const { createCoverageMap } = import.meta.require("istanbul-lib-coverage")

export const generateCoverageHtmlReport = ({
  projectPathname,
  coverageHtmlReportFolderRelativePath,
  coverageHtmlReportIndexLog,
  coverageMap,
}) => {
  const dir = pathnameToOperatingSystemPath(
    `${projectPathname}${coverageHtmlReportFolderRelativePath}`,
  )
  const context = libReport.createContext({
    dir,
    coverageMap: createCoverageMap(coverageMap),
  })

  const report = reports.create("html", {
    skipEmpty: true,
    skipFull: true,
  })
  report.execute(context)

  if (coverageHtmlReportIndexLog) {
    const htmlCoverageReportIndexPath = pathnameToOperatingSystemPath(
      `${projectPathname}${coverageHtmlReportFolderRelativePath}/index.html`,
    )
    console.log(`-> ${htmlCoverageReportIndexPath}`)
  }
}
