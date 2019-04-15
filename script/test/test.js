const { test } = require("@jsenv/core")
const {
  projectFolder,
  compileInto,
  babelConfigMap,
  testDescription,
} = require("../../jsenv.config.js")

test({
  projectFolder,
  compileInto,
  babelConfigMap,
  executeDescription: testDescription,
})
