const { test } = require("@jsenv/core")
const {
  importMap,
  projectFolder,
  compileInto,
  babelPluginDescription,
} = require("../../jsenv.config.js")
const { testDescription } = require("./test.config.js")

test({
  importMap,
  projectFolder,
  compileInto,
  babelPluginDescription,
  executeDescription: testDescription,
})
