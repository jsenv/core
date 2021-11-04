import { require } from "../../require.js"

export const composeTwoIstanbulCoverages = (
  firstIstanbulCoverage,
  secondIstanbulCoverage,
) => {
  const { createFileCoverage } = require("istanbul-lib-coverage")
  const istanbulFileCoverageObject = createFileCoverage(firstIstanbulCoverage)
  istanbulFileCoverageObject.merge(secondIstanbulCoverage)
  const istanbulCoverage = istanbulFileCoverageObject.toJSON()
  return istanbulCoverage
}
