const { cover } = require("@jsenv/core")
const { projectPath, testDescription } = require("../../jsenv.config.js")

cover({
  projectPath,
  executeDescription: testDescription,
})
