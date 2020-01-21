import { require } from "internal/require.js"

const libReport = require("istanbul-lib-report")
const reports = require("istanbul-reports")
const { createCoverageMap } = require("istanbul-lib-coverage")

export const generateCoverageTextLog = ({ coverageMap }) => {
  const context = libReport.createContext({
    coverageMap: createCoverageMap(coverageMap),
  })
  const report = reports.create("text", {
    skipEmpty: true,
    skipFull: true,
  })
  report.execute(context)
}
