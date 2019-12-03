const { generateGlobalBundle } = require("@jsenv/core")

generateGlobalBundle({
  projectDirectoryPath: __dirname,
  globalName: "__whatever__",
})
