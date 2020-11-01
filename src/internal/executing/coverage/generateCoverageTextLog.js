import { require } from "../../require.js"

export const generateCoverageTextLog = (coverageMap) => {
  const libReport = require("istanbul-lib-report")
  const reports = require("istanbul-reports")
  const { createCoverageMap } = require("istanbul-lib-coverage")

  const context = libReport.createContext({
    coverageMap: createCoverageMap(coverageMap),
  })
  const report = reports.create("text", {
    skipEmpty: true,
    skipFull: true,
  })
  report.execute(context)
}
