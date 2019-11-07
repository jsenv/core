const libReport = import.meta.require("istanbul-lib-report")
const reports = import.meta.require("istanbul-reports")
const { createCoverageMap } = import.meta.require("istanbul-lib-coverage")

export const generateCoverageConsoleReport = ({ coverageMap }) => {
  const context = libReport.createContext({
    coverageMap: createCoverageMap(coverageMap),
  })
  const report = reports.create("text", {
    skipEmpty: true,
    skipFull: true,
  })
  report.execute(context)
}
