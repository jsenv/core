const { createFileCoverage } = import.meta.require("istanbul-lib-coverage")

export const createEmptyCoverage = (relativePath) =>
  createFileCoverage(relativePath.slice(1)).toJSON()
