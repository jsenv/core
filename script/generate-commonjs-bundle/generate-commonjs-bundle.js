const { generateCommonJsBundleForNode } = require("@jsenv/core")
const { projectDirectoryPath } = require("../../jsenv.config.js")

generateCommonJsBundleForNode({
  projectDirectoryPath,
})
