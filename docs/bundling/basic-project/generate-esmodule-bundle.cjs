/* global require, __dirname */
const { generateEsModuleBundle } = require("@jsenv/core")

generateEsModuleBundle({
  projectDirectoryUrl: __dirname,
})
