const { cover } = require("@jsenv/core")
const {
  projectFolder,
  compileInto,
  babelConfigMap,
  coverDescription,
  testDescription,
} = require("../../jsenv.config.js")

cover({
  projectFolder,
  compileInto,
  babelConfigMap,
  coverDescription,
  executeDescription: testDescription,
  logCoverageTable: true,
})
