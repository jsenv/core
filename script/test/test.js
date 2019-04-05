const { test } = require("@jsenv/core")
const { importMap, projectFolder, compileInto, babelConfigMap } = require("../../jsenv.config.js")
const { testDescription } = require("./test.config.js")

test({
  importMap,
  projectFolder,
  compileInto,
  babelConfigMap,
  executeDescription: testDescription,
})
