const { test } = require("@jsenv/core")
const { projectFolder, compileInto, babelConfigMap } = require("../../jsenv.config.js")
const { testDescription } = require("./test.config.js")

test({
  projectFolder,
  compileInto,
  babelConfigMap,
  executeDescription: testDescription,
})
