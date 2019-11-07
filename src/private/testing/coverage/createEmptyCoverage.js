const { createFileCoverage } = import.meta.require("istanbul-lib-coverage")

export const createEmptyCoverage = (relativePath) => createFileCoverage(relativePath).toJSON()
