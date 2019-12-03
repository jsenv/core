const { generateCommonJsBundleForNode } = require("../../dist/commonjs/main.js")
const jsenvConfig = require("../../jsenv.config.js")

generateCommonJsBundleForNode({
  ...jsenvConfig,
})
