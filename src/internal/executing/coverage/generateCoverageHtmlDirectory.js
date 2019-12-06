import { resolveDirectoryUrl, urlToFilePath } from "internal/urlUtils.js"

const libReport = import.meta.require("istanbul-lib-report")
const reports = import.meta.require("istanbul-reports")
const { createCoverageMap } = import.meta.require("istanbul-lib-coverage")

export const generateCoverageHtmlDirectory = ({
  projectDirectoryUrl,
  coverageHtmlDirectoryRelativeUrl,
  coverageHtmlDirectoryIndexLog,
  coverageMap,
}) => {
  const htmlDirectoryUrl = resolveDirectoryUrl(
    coverageHtmlDirectoryRelativeUrl,
    projectDirectoryUrl,
  )
  const htmlDirectoryPath = urlToFilePath(htmlDirectoryUrl)
  const context = libReport.createContext({
    dir: htmlDirectoryPath,
    coverageMap: createCoverageMap(coverageMap),
  })

  const report = reports.create("html", {
    skipEmpty: true,
    skipFull: true,
  })
  report.execute(context)

  if (coverageHtmlDirectoryIndexLog) {
    const htmlCoverageDirectoryIndexFileUrl = `${htmlDirectoryUrl}index.html`
    const htmlCoverageDirectoryIndexFilePath = urlToFilePath(htmlCoverageDirectoryIndexFileUrl)
    console.log(`-> ${htmlCoverageDirectoryIndexFilePath}`)
  }
}
