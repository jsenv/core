import { require } from "../../require.js"

export const createEmptyCoverage = (relativeUrl) => {
  const { createFileCoverage } = require("istanbul-lib-coverage")
  return createFileCoverage(relativeUrl).toJSON()
}
