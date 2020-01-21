/* global require, __dirname */
const { generateSystemJsBundle } = require("@jsenv/core")

generateSystemJsBundle({
  projectDirectoryUrl: __dirname,
})
