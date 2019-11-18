const { createFileCoverage } = import.meta.require("istanbul-lib-coverage")

export const createEmptyCoverage = (relativeUrl) => createFileCoverage(relativeUrl).toJSON()
