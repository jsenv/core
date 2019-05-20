const { cover } = require("@jsenv/core")
const { projectPath, coverDescription, testDescription } = require("../../jsenv.config.js")

cover({
  projectPath,
  coverDescription,
  executeDescription: testDescription,
})
