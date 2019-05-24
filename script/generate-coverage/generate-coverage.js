const { cover, jsenvCoverDescription } = require("@jsenv/core")
const { projectPath } = require("../../jsenv.config.js")

cover({
  projectPath,
  coverDescription: {
    ...jsenvCoverDescription,
    "/node_modules/@jsenv/core/": true, // also cover jsenv internal files
  },
  logCoverageTable: true,
})
