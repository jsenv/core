/* global require, __dirname */
const { generateGlobalBundle } = require("@jsenv/core")

generateGlobalBundle({
  projectDirectoryUrl: __dirname,
  globalName: "__whatever__",
})
