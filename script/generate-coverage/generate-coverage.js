const { cover } = require("@jsenv/core")
const { projectFolder, coverDescription, testDescription } = require("../../jsenv.config.js")

cover({
  projectFolder,
  coverDescription,
  executeDescription: testDescription,
  logCoverageTable: true,
})
