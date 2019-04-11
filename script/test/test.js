const { test } = require("@jsenv/core")
const {
  readImportMap,
  projectFolder,
  compileInto,
  babelConfigMap,
} = require("../../jsenv.config.js")
const { testDescription } = require("./test.config.js")

test({
  importMap: readImportMap(),
  projectFolder,
  compileInto,
  babelConfigMap,
  executeDescription: testDescription,
})
