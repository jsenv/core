const { generateGlobalBundle } = require("@jsenv/bundling")

generateGlobalBundle({
  projectDirectoryPath: __dirname,
  globalName: "__whatever__",
})
