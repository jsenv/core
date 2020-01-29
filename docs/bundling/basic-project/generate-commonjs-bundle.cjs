/* global require, __dirname */
const { generateCommonJsBundle } = require("@jsenv/core")

generateCommonJsBundle({
  projectDirectoryUrl: __dirname,
})
